const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function testDb() {
  try {
    await client.connect();
    console.log('Successfully connected to Supabase PostgreSQL!');
    const res = await client.query('SELECT NOW()');
    console.log('Current Time from DB:', res.rows[0].now);
    await client.end();
  } catch (err) {
    console.error('Connection error', err.stack);
  }
}

testDb();
