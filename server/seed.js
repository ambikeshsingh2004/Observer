const { Client } = require('pg');
const { faker } = require('@faker-js/faker');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const isRender = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com');
const sslConfig = (isProduction || isRender) ? { rejectUnauthorized: false } : false;

console.log(`🔌 Connecting to database... (SSL: ${!!sslConfig})`);

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig
});

const BATCH_SIZE = 10000; // Insert 10k rows at a time
const TARGET_LARGE = 1000000; // 1 Million
const TARGET_SMALL = 1000;   // 1 Thousand

async function createTables() {
  await client.query(`
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

  await client.query(`
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
  console.log("✅ Tables created.");
}

async function seedTable(tableName, count) {
  console.log(`🌱 Seeding ${tableName} with ${count} rows...`);
  const startTime = Date.now();
  let totalInserted = 0;

  while (totalInserted < count) {
    const batch = [];
    const currentBatchSize = Math.min(BATCH_SIZE, count - totalInserted);

    for (let i = 0; i < currentBatchSize; i++) {
      batch.push(`(
                '${faker.person.firstName().replace(/'/g, "''")}',
                '${faker.person.lastName().replace(/'/g, "''")}',
                '${faker.internet.email()}',
                ${faker.number.int({ min: 18, max: 80 })},
                '${faker.location.country().replace(/'/g, "''")}',
                '${faker.lorem.sentence().replace(/'/g, "''")}'
            )`);
    }

    const query = `
            INSERT INTO ${tableName} (first_name, last_name, email, age, country, bio)
            VALUES ${batch.join(',')}
        `;

    await client.query(query);
    totalInserted += currentBatchSize;
    process.stdout.write(`\rProgress: ${totalInserted}/${count} (${Math.round((totalInserted / count) * 100)}%)`);
  }

  console.log(`\n✅ Finished seeding ${tableName} in ${(Date.now() - startTime) / 1000}s`);
}

async function main() {
  try {
    await client.connect();
    await createTables();

    // Clear existing data? Optional, but good for idempotency
    await client.query('TRUNCATE users_small, users_large RESTART IDENTITY');

    await seedTable('users_small', TARGET_SMALL);
    await seedTable('users_large', TARGET_LARGE);

  } catch (err) {
    console.error("❌ Error seeding:", err);
  } finally {
    await client.end();
  }
}

main();
