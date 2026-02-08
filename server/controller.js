const { Client } = require('pg');
const redis = require('redis');
const crypto = require('crypto');
require('dotenv').config();

// PostgreSQL Client
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
});
pgClient.connect().catch(err => console.error('PG Connect Error', err));

// Redis Client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});
redisClient.connect().catch(err => console.error('Redis Connect Error', err));

// Helper: Hash query for Redis key
const getCacheKey = (sql) => {
  return crypto.createHash('md5').update(sql).digest('hex');
};

const Controller = {
  // 1. Dynamic Query Builder
  async runQuery(req, res) {
    const { table, column, value, useIndex } = req.body;
    // In real app, validate table/column to prevent SQL Injection
    // For this demo, we assume inputs are safe-ish or from valid dropdowns

    const query = `SELECT * FROM ${table} WHERE ${column} = $1`;
    const startTime = process.hrtime();

    try {
      // Note: Postgres uses index automatically if efficient.
      // We can force it or just let the optimizer decide.
      // For demo, "useIndex" might just mean "ensure index exists first"

      const result = await pgClient.query(query, [value]);
      const diff = process.hrtime(startTime);
      const duration = (diff[0] * 1000 + diff[1] / 1e6); // ms

      res.json({
        data: result.rows,
        duration: duration.toFixed(3), // ms
        rows: result.rowCount,
        source: 'database'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 2. Raw SQL Executor with Cache Toggle
  async runRawSQL(req, res) {
    const { query, useCache } = req.body;
    // Convert input query to lowercase for checking "select" but EXECUTE original
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery.startsWith('select') && !lowerQuery.startsWith('explain')) {
      return res.status(400).json({ error: "Only SELECT or EXPLAIN queries allowed in this playground." });
    }

    const startTime = process.hrtime();

    try {
      if (useCache) {
        const cacheKey = getCacheKey(query);
        const cachedData = await redisClient.get(cacheKey);

        if (cachedData) {
          const diff = process.hrtime(startTime);
          return res.json({
            data: JSON.parse(cachedData),
            duration: (diff[0] * 1000 + diff[1] / 1e6).toFixed(3),
            source: 'redis',
            cached: true
          });
        }
      }

      const result = await pgClient.query(query);
      const diff = process.hrtime(startTime);
      const duration = (diff[0] * 1000 + diff[1] / 1e6).toFixed(3);

      if (useCache) {
        const cacheKey = getCacheKey(query);
        await redisClient.set(cacheKey, JSON.stringify(result.rows), {
          EX: 60 // Cache for 60 seconds
        });
      }

      res.json({
        data: result.rows,
        duration: duration,
        rows: result.rowCount,
        source: 'database',
        cached: false
      });

    } catch (err) {
      // Return raw Postgres error for validation ID
      res.json({
        error: true,
        message: err.message,
        detail: err.detail || "Syntax error or missing table/column",
        position: err.position
      });
    }
  },

  // 3. Index Management
  async manageIndex(req, res) {
    const { action, table, column, type } = req.body;
    const indexName = `idx_${table}_${column}`;

    const startTime = process.hrtime();

    try {
      if (action === 'create') {
        // CREATE INDEX CONCURRENTLY to not lock table
        // Type: USING btree, hash, gist, etc.
        const indexType = type || 'btree';
        await pgClient.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${table} USING ${indexType} (${column})`);

      } else if (action === 'drop') {
        await pgClient.query(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`);
      }

      const diff = process.hrtime(startTime);
      res.json({
        success: true,
        message: `Index ${indexName} ${action}d successfully.`,
        duration: (diff[0] * 1000 + diff[1] / 1e6).toFixed(3)
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = Controller;
