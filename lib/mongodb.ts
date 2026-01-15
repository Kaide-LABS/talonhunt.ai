import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const options = {
  maxPoolSize: 10,      // Reasonable for serverless
  minPoolSize: 1,
  maxIdleTimeMS: 10000, // Close idle connections quickly
};

let cachedClient: MongoClient | null = null;

export async function getDb(): Promise<Db> {
  if (cachedClient) {
    return cachedClient.db('talonhunt');
  }

  const client = new MongoClient(uri, options);
  await client.connect();
  cachedClient = client;

  return client.db('talonhunt');
}

// For health checks
export async function isConnected(): Promise<boolean> {
  try {
    if (!cachedClient) {
      const client = new MongoClient(uri, options);
      await client.connect();
      cachedClient = client;
    }
    await cachedClient.db('talonhunt').command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
