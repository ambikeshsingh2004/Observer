const { Client } = require('pg');
require('dotenv').config();

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createTables() {
  try {
    await pgClient.connect();

    // 1. App Users (Auth)
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ app_users table ready');

    // 2. Users Large (Experiments)
    await pgClient.query(`
        CREATE TABLE IF NOT EXISTS users_large (
            id SERIAL PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            age INT,
            country TEXT,
            bio TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `);
    console.log('✅ users_large table ready');

    // 3. Users Small (Experiments)
    await pgClient.query(`
        CREATE TABLE IF NOT EXISTS users_small (
            id SERIAL PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            age INT,
            country TEXT,
            bio TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `);
    console.log('✅ users_small table ready');

    await pgClient.end();
  } catch (err) {
    console.error('❌ Error creating tables:', err.message);
    process.exit(1);
  }
}

createTables();
