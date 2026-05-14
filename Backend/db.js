import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URL || process.env.DATABASE_URL;
const databaseName = process.env.MONGODB_DB || process.env.MONGO_DB || "thesis_software";

if (!mongoUri) {
  throw new Error("Missing MongoDB connection string in environment. Set one of: MONGODB_URI, MONGO_URI, MONGO_URL, or DATABASE_URL.");
}

if (!String(mongoUri).startsWith("mongodb://") && !String(mongoUri).startsWith("mongodb+srv://")) {
  throw new Error("MONGODB_URI must be a MongoDB connection string.");
}

const client = new MongoClient(mongoUri, {
  maxPoolSize: Number(process.env.DATABASE_POOL_SIZE || 10),
});

let dbInstance;

function previewConnectionString(value) {
  return String(value || "").replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}

function toRecord(input) {
  return input && typeof input === "object" ? input : {};
}

function createCollection(db, collectionName) {
  const collection = db.collection(collectionName);

  return {
    find(query = {}) {
      return collection.find(toRecord(query));
    },

    aggregate(pipeline = []) {
      return collection.aggregate(Array.isArray(pipeline) ? pipeline : []);
    },

    countDocuments(query = {}) {
      return collection.countDocuments(toRecord(query));
    },

    findOne(query = {}) {
      return collection.findOne(toRecord(query));
    },

    insertOne(document) {
      return collection.insertOne(toRecord(document));
    },

    insertMany(documents) {
      return collection.insertMany(Array.isArray(documents) ? documents.map(toRecord) : []);
    },

    updateOne(query = {}, update = {}, options = {}) {
      return collection.updateOne(toRecord(query), update, options);
    },

    updateMany(query = {}, update = {}, options = {}) {
      return collection.updateMany(toRecord(query), update, options);
    },

    findOneAndUpdate(query = {}, update = {}, options = {}) {
      return collection.findOneAndUpdate(toRecord(query), update, options);
    },

    deleteOne(query = {}) {
      return collection.deleteOne(toRecord(query));
    },

    findOneAndDelete(query = {}, options = {}) {
      return collection.findOneAndDelete(toRecord(query), options);
    },

    replaceOne(query = {}, document = {}) {
      return collection.replaceOne(toRecord(query), toRecord(document), { upsert: true });
    },

    deleteMany(query = {}) {
      return collection.deleteMany(toRecord(query));
    },
  };
}

export async function getDb() {
  if (!dbInstance) {
    try {
      console.log("Connecting to MongoDB...", {
        uriPreview: previewConnectionString(mongoUri),
        databaseName,
      });

      await client.connect();
      const db = client.db(databaseName);
      dbInstance = {
        collection: (name) => createCollection(db, name),
      };
    } catch (err) {
      console.error("MongoDB connection error:", err);
      throw err;
    }
  }

  return dbInstance;
}