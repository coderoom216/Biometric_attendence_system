
import { MongoClient, Db, Collection } from 'mongodb';

const uri = process.env.BIOMETRIC_MONGO_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.BIOMETRIC_MONGO_DB || 'biometric_db';
const collectionName = process.env.BIOMETRIC_MONGO_COLLECTION || 'glog_data';

let client: MongoClient | null = null;
let db: Db | null = null;

// Connect to MongoDB and reuse the connection
async function getDatabase(): Promise<Db> {
  if (!client) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
  }

  if (!db) {
    db = client.db(dbName);
  }

  return db;
}

// Existing punch collection: glog_data
export async function getBiometricCollection(): Promise<Collection> {
  const database = await getDatabase();
  return database.collection(collectionName);
}

// Read other SDK collections: get_user_id, user_info_result
export async function getBiometricNamedCollection(
  name: string
): Promise<Collection> {
  const database = await getDatabase();
  return database.collection(name);
}

// MongoDB connection status
export async function getBiometricMongoStatus() {
  try {
    const collection = await getBiometricCollection();
    const total = await collection.countDocuments();
    const latest = await collection.find({}).sort({ id: -1 }).limit(1).next();

    return {
      connected: true,
      database: dbName,
      collection: collectionName,
      totalRecords: total,
      latestRecordAt: latest?.io_time ?? null
    };
  } catch (error) {
    return {
      connected: false,
      database: dbName,
      collection: collectionName,
      error: error instanceof Error
        ? error.message
        : 'MongoDB connection failed'
    };
  }
}
