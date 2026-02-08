const redis = require('redis');

async function testRedis() {
  const client = redis.createClient({
    url: 'redis://localhost:6379'
  });

  client.on('error', (err) => console.log('Redis Client Error', err));

  await client.connect();
  console.log('Successfully connected to Redis!');
  await client.set('test_key', 'Hello from Windows!');
  const value = await client.get('test_key');
  console.log('Retrieved value:', value);
  await client.disconnect();
}

testRedis();
