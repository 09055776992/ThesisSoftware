import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "thesis_software";

if (!uri) {
  throw new Error("Missing MONGODB_URI in environment.");
}

const allowInsecure = String(process.env.MONGODB_TLS_INSECURE || "false").toLowerCase() === "true";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  tls: true,
  tlsAllowInvalidCertificates: allowInsecure,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
});

let dbInstance;

export async function getDb() {
  if (!dbInstance) {
    try {
      console.log("Connecting to MongoDB...", { uriPreview: uri.replace(/:(\\w+)@/, ':****@'), tlsInsecure: allowInsecure });
      await client.connect();
      dbInstance = client.db(dbName);
    } catch (err) {
      // Provide clearer guidance for TLS handshake failures
      const isTlsError = (err && (err.message || "")).includes('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR') ||
        (err && err.cause && (String(err.cause.reason || '')).toLowerCase().includes('tls'));

      if (isTlsError && !allowInsecure) {
        console.error('MongoDB TLS/SSL handshake failed. If you are on a network that intercepts TLS (corporate proxy / antivirus), you can try setting MONGODB_TLS_INSECURE=true in Backend/.env for local testing.');
      }

      console.error("MongoDB connection error:", err);
      throw err;
    }
  }
  return dbInstance;
}
