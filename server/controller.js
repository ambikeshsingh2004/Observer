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
    const startTime = process.hrtime();

    try {
      const lowerQuery = query.toLowerCase().trim();

      // SAFETY: Block dangerous commands for public demo
      const unsafeKeywords = [
        'drop table', 'truncate', 'alter table', 'grant', 'revoke',
        'insert into', 'update', 'delete from', 'create table', 'drop database'
      ];

      const isUnsafe = unsafeKeywords.some(keyword => lowerQuery.includes(keyword));

      // Allow SELECT and EXPLAIN
      const isAllowed = lowerQuery.startsWith('select') || lowerQuery.startsWith('explain');

      if (isUnsafe && !isAllowed) {
        return res.json({
          error: true,
          message: "Safety Guard: Destructive commands are blocked in this demo.",
          detail: "Only SELECT and EXPLAIN queries are allowed."
        });
      }

      let resultRows = [];
      let rowCount = 0;
      let duration = 0;
      let scanType = 'N/A';
      let breakdown = [];

      // HELPER: Plan Parser
      const parsePlan = (planObj) => {
        const traverse = (node) => {
          let nodes = [];
          if (node['Node Type']) {
            nodes.push({
              type: node['Node Type'],
              time: node['Actual Total Time'] || 0,
              rows: node['Actual Rows'] || 0
            });
          }
          if (node.Plans) {
            node.Plans.forEach(child => nodes = nodes.concat(traverse(child)));
          }
          return nodes;
        };
        const allNodes = traverse(planObj);
        breakdown = allNodes.sort((a, b) => b.time - a.time).slice(0, 3);

        const scanner = allNodes.find(n => n.type.includes('Scan'));
        if (scanner) {
          if (scanner.type.includes('Seq Scan')) scanType = 'Sequential Scan 🔴';
          else if (scanner.type.includes('Index')) scanType = 'Index Scan 🟢';
          else scanType = scanner.type + ' 🟡';
        }
        return allNodes;
      };

      // 1. Determine Query Type
      const isExplainable = /^\s*(select|insert|update|delete)/i.test(query);

      if (isExplainable) {
        if (/^\s*select/i.test(query)) {
          // SELECT: Safe to run query then explain

          // Check Cache
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

          // Execute
          const result = await pgClient.query(query);
          resultRows = result.rows;
          rowCount = result.rowCount;

          const diff = process.hrtime(startTime);
          duration = (diff[0] * 1000 + diff[1] / 1e6).toFixed(3);

          // Explain
          try {
            const explainRes = await pgClient.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`);
            const planObj = explainRes.rows[0]['QUERY PLAN'][0]['Plan'];
            parsePlan(planObj);
          } catch (e) {
            console.error("Explain Error (Select):", e.message);
            scanType = 'Explain Failed';
          }

          // Cache
          if (useCache) {
            const cacheKey = getCacheKey(query);
            await redisClient.set(cacheKey, JSON.stringify(resultRows), { EX: 60 });
          }

        } else {
          // DML (Insert/Update/Delete): EXPLAIN ANALYZE executes it.
          const explainRes = await pgClient.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`);
          const planObj = explainRes.rows[0]['QUERY PLAN'][0]['Plan'];

          parsePlan(planObj);
          duration = planObj['Actual Total Time'] || 0;
          rowCount = planObj['Actual Rows'] || 0;
          resultRows = [{ status: "Modification Executed", plan: "See metrics" }];
        }

      } else {
        // UTILITY (Create, Drop, etc.): Just Execute
        const result = await pgClient.query(query);
        const diff = process.hrtime(startTime);

        resultRows = [{ status: "Command Successful", rows_affected: result.rowCount || 0 }];
        rowCount = result.rowCount || 0;
        duration = (diff[0] * 1000 + diff[1] / 1e6).toFixed(3);
        scanType = 'Utility Command';
      }

      const processingTime = process.hrtime(startTime);
      const procDuration = (processingTime[0] * 1000 + processingTime[1] / 1e6).toFixed(3);

      res.json({
        data: resultRows,
        dbDuration: duration,
        serverDuration: procDuration,
        rows: rowCount,
        source: 'database',
        scanType: scanType,
        breakdown: breakdown,
        cached: false
      });

    } catch (err) {
      res.json({
        error: true,
        message: err.message,
        detail: err.detail || "Syntax or Logic Error",
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
  },

  // 5. Selectivity Experiment Helper
  async modifyData(req, res) {
    const { action } = req.body;
    const startTime = process.hrtime();

    try {
      let message = "Operation completed.";

      if (action === 'skew') {
        // Skew data: Set 20% of rows to 'China' to trigger Seq Scan trap
        await pgClient.query(`UPDATE users_large SET country = 'China' WHERE id % 5 = 0`);
        // Ensure 'Vatican' exists for the rare case
        await pgClient.query(`UPDATE users_large SET country = 'Vatican' WHERE id = 1`);
        message = "Data skewed successfully. 'China' is now 20% of table.";
      } else if (action === 'reset') {
        // Reset (optional, or just re-seed)
        message = "Data reset (if implemented).";
      }

      if (action === 'selectivity_test') {
        const { step, threshold } = req.body;

        // 1. Seed Data (Score 1-100 uniform distribution)
        if (step === 'seed') {
          await pgClient.query(`DROP TABLE IF EXISTS selectivity_test`);
          await pgClient.query(`
              CREATE TABLE selectivity_test (
                id SERIAL PRIMARY KEY,
                score INT,
                payload TEXT,
                created_at TIMESTAMP DEFAULT NOW()
              )
            `);

          // Insert 200k rows with random score 1-100
          await pgClient.query(`
              INSERT INTO selectivity_test (score, payload)
              SELECT 
                (random() * 100)::int,
                md5(random()::text)
              FROM generate_series(1, 200000)
            `);

          await pgClient.query(`CREATE INDEX idx_score ON selectivity_test(score)`);
          await pgClient.query(`ANALYZE selectivity_test`);

          return res.json({ success: true, message: "Seeded 200k rows with scores 0-100." });
        }

        // 2. Check Data
        if (step === 'check') {
          try {
            const r = await pgClient.query("SELECT count(*) FROM selectivity_test");
            return res.json({ count: parseInt(r.rows[0].count) });
          } catch (e) { return res.json({ count: 0 }); }
        }

        // 3. Run Query
        if (step === 'run') {
          const query = `SELECT * FROM selectivity_test WHERE score < ${threshold}`;

          // Get Explain
          const explainRes = await pgClient.query("EXPLAIN (ANALYZE, FORMAT JSON) " + query);
          const planObj = explainRes.rows[0]['QUERY PLAN'][0];
          const plan = planObj['Plan'];
          const duration = planObj['Execution Time'].toFixed(2);

          // Helper to find stats
          const findStats = (node) => {
            if (node['Node Type'].includes('Scan')) {
              return {
                scanType: node['Node Type'],
                indexName: node['Index Name'] || 'N/A',
                rowsScanned: node['Actual Rows'],
                rowsRemoved: node['Rows Removed by Filter'] || 0
              };
            }
            if (node.Plans) return findStats(node.Plans[0]);
            return { scanType: node['Node Type'], rowsScanned: node['Actual Rows'], rowsRemoved: 0, indexName: 'N/A' };
          };

          const stats = findStats(plan);

          return res.json({
            success: true,
            duration,
            threshold,
            details: {
              scanType: stats.scanType,
              indexName: stats.indexName,
              rowsScanned: stats.rowsScanned + stats.rowsRemoved,
              rowsReturned: plan['Actual Rows']
            }
          });
        }
      }

      if (action === 'check_composite_data') {
        try {
          const res = await pgClient.query("SELECT count(*) FROM composite_test");
          return res.json({ count: parseInt(res.rows[0].count) });
        } catch (e) {
          return res.json({ count: 0 }); // Table likely doesn't exist
        }
      }

      if (action === 'composite_test') {
        const { step } = req.body;

        // 1. Reset & Seed
        if (step === 'reset') {
          await pgClient.query(`DROP TABLE IF EXISTS composite_test`);
          await pgClient.query(`
                CREATE TABLE composite_test (
                    id SERIAL PRIMARY KEY, 
                    status TEXT, 
                    created_at TIMESTAMP
                )
            `);
          // Insert 100k rows: 50% Active, 50% Archived. Random dates in last year.
          await pgClient.query(`
                INSERT INTO composite_test (status, created_at)
                SELECT 
                    CASE WHEN random() < 0.02 THEN 'Active' ELSE 'Archived' END,
                    NOW() - (random() * interval '365 days')
                FROM generate_series(1, 1000000)
            `);
          return res.json({ success: true, message: "Reset: 1M rows (2% Active, 98% Archived) - May take 5-10s." });
        }

        // 2. Run Test Cases
        let idxName = '';
        if (step === 'test_none') {
          await pgClient.query(`DROP INDEX IF EXISTS idx_status; DROP INDEX IF EXISTS idx_date; DROP INDEX IF EXISTS idx_composite;`);
          idxName = 'No Index';
        }
        if (step === 'test_status') {
          await pgClient.query(`DROP INDEX IF EXISTS idx_date; DROP INDEX IF EXISTS idx_composite;`);
          await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_status ON composite_test(status)`);
          await pgClient.query(`ANALYZE composite_test`); // Ensure planner sees new index stats
          idxName = 'Index(Status)';
        }
        if (step === 'test_date') {
          await pgClient.query(`DROP INDEX IF EXISTS idx_status; DROP INDEX IF EXISTS idx_composite;`);
          await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_date ON composite_test(created_at)`);
          await pgClient.query(`ANALYZE composite_test`);
          idxName = 'Index(Date)';
        }
        if (step === 'test_composite') {
          await pgClient.query(`DROP INDEX IF EXISTS idx_status; DROP INDEX IF EXISTS idx_date;`);
          await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_composite ON composite_test(status, created_at)`);
          await pgClient.query(`ANALYZE composite_test`);
          idxName = 'Composite(Status, Date)';
        }

        // Run Query & Explain
        // USER REQUEST: "Remove LIMIT", "High Selectivity" (interpreted as difficult filter), "1M Rows"
        // We use EXPLAIN ANALYZE to measure time without sending 500k rows to client.
        const query = "SELECT * FROM composite_test WHERE status = 'Active' ORDER BY created_at DESC LIMIT 1000";

        // Timer is less useful here because we aren't fetching rows to Node, 
        // relying on Postgres Execution Time from Explain is more accurate for "DB Work".

        // Get Explain
        const explainRes = await pgClient.query("EXPLAIN (ANALYZE, FORMAT JSON) " + query);
        const planObj = explainRes.rows[0]['QUERY PLAN'][0];
        const plan = planObj['Plan'];
        const duration = planObj['Execution Time'].toFixed(2); // Postgres reported execution time

        // Helper to find the "Workhorse" node (Scan or Sort)
        const findStats = (node) => {
          // If we found a scan, return its stats
          if (node['Node Type'].includes('Scan')) {
            return {
              scanType: node['Node Type'],
              indexName: node['Index Name'] || 'N/A',
              rowsScanned: node['Actual Rows'], // Rows passed up by scan
              rowsRemoved: node['Rows Removed by Filter'] || 0
            };
          }
          // If Limit/Sort, dig deeper
          if (node.Plans) {
            return findStats(node.Plans[0]);
          }
          return { scanType: node['Node Type'], rowsScanned: node['Actual Rows'], rowsRemoved: 0, indexName: 'N/A' };
        };

        const stats = findStats(planObj['Plan']);

        // Safe extraction of details
        const details = {
          scanType: stats.scanType,
          indexName: stats.indexName,
          rowsReturned: planObj['Plan']['Actual Rows'], // Top level (Limit)
          rowsScanned: stats.rowsScanned + stats.rowsRemoved, // Total rows touched
          rowsRemoved: stats.rowsRemoved,
          cost: planObj['Plan']['Total Cost']
        };

        return res.json({
          success: true,
          message: `Ran with ${idxName}`,
          duration,
          planType: planObj['Plan']['Node Type'], // legacy
          details,
          idxName
        });
      }

      if (action === 'index_cost_test') {
        const { step } = req.body;
        // Step 0: Reset & Insert (0 Indexes)
        if (step === 0) {
          await pgClient.query(`DROP TABLE IF EXISTS insert_test`);
          await pgClient.query(`CREATE TABLE insert_test (id SERIAL PRIMARY KEY, col1 INT, col2 INT, col3 INT, col4 INT)`);
        }

        // Steps 1-4: Add Index before inserting
        if (step === 1) await pgClient.query(`CREATE INDEX idx_col1 ON insert_test(col1)`);
        if (step === 2) await pgClient.query(`CREATE INDEX idx_col2 ON insert_test(col2)`);
        if (step === 3) await pgClient.query(`CREATE INDEX idx_col3 ON insert_test(col3)`);
        if (step === 4) await pgClient.query(`CREATE INDEX idx_col4 ON insert_test(col4)`);

        // Perform Insert (100k rows)
        const insertStart = process.hrtime();
        await pgClient.query(`
          INSERT INTO insert_test (col1, col2, col3, col4)
          SELECT 
            (random() * 1000)::int,
            (random() * 1000)::int,
            (random() * 1000)::int,
            (random() * 1000)::int
          FROM generate_series(1, 100000)
        `);
        const diff = process.hrtime(insertStart);
        const duration = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2); // ms

        message = `Inserted 100k rows with ${step} indexes in ${duration}ms`;
        return res.json({ success: true, message, duration, step });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 4. External API Simulation (Real Network Request)
  async fetchExternalData(req, res) {
    const startTime = process.hrtime();
    const axios = require('axios'); // Require here or top-level if installed

    try {
      // Fetching 100 products to simulation a "heavy" external payload
      const response = await axios.get('https://dummyjson.com/products?limit=100');

      const diff = process.hrtime(startTime);
      const duration = (diff[0] * 1000 + diff[1] / 1e6).toFixed(3);

      res.json({
        data: response.data.products.slice(0, 5), // Return subset to keep UI clean
        duration: duration,
        rows: response.data.products.length,
        source: 'dummyjson.com (external)'
      });

    } catch (err) {
      res.status(502).json({ error: "Failed to fetch external API: " + err.message });
    }
  }
};

module.exports = Controller;
