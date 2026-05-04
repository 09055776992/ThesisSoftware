import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL in environment.");
}

const sslMode = String(process.env.DATABASE_SSL || "require").toLowerCase();
const pool = new Pool({
  connectionString,
  ssl: sslMode === "disable" ? false : { rejectUnauthorized: false },
  max: Number(process.env.DATABASE_POOL_SIZE || 10),
});

let schemaReady = false;
let dbInstance;

function previewConnectionString(value) {
  return String(value || "").replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}

function toRecord(input) {
  return input && typeof input === "object" ? input : {};
}

function toJson(query) {
  return JSON.stringify(toRecord(query));
}

function mapRow(row) {
  if (!row) {
    return null;
  }

  const data = row.data && typeof row.data === "object" ? row.data : {};
  return { id: row.id, ...data };
}

async function ensureSchema() {
  if (schemaReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id BIGSERIAL PRIMARY KEY,
      collection TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS documents_collection_idx
      ON documents (collection);

    CREATE INDEX IF NOT EXISTS documents_collection_data_gin_idx
      ON documents USING GIN (data);
  `);

  schemaReady = true;
}

function buildWhere(collectionName, query) {
  const filters = toRecord(query);
  const values = [collectionName];
  const clauses = ["collection = $1"];

  if (Object.keys(filters).length > 0) {
    values.push(toJson(filters));
    clauses.push(`data @> $${values.length}::jsonb`);
  }

  return { values, where: clauses.join(" AND ") };
}

function createCollection(collectionName) {
  return {
    find(query = {}) {
      return {
        async toArray() {
          await ensureSchema();
          const { values, where } = buildWhere(collectionName, query);
          const result = await pool.query(
            `SELECT id, data FROM documents WHERE ${where} ORDER BY id ASC`,
            values,
          );
          return result.rows.map(mapRow).filter(Boolean);
        },
      };
    },

    async findOne(query = {}) {
      await ensureSchema();
      const { values, where } = buildWhere(collectionName, query);
      const result = await pool.query(
        `SELECT id, data FROM documents WHERE ${where} ORDER BY id ASC LIMIT 1`,
        values,
      );
      return mapRow(result.rows[0] || null);
    },

    async insertOne(document) {
      await ensureSchema();
      const result = await pool.query(
        "INSERT INTO documents (collection, data) VALUES ($1, $2::jsonb) RETURNING id",
        [collectionName, JSON.stringify(toRecord(document))],
      );
      return { insertedId: result.rows[0].id };
    },

    async deleteMany(query = {}) {
      await ensureSchema();
      const { values, where } = buildWhere(collectionName, query);
      const result = await pool.query(`DELETE FROM documents WHERE ${where}`, values);
      return { deletedCount: result.rowCount };
    },
  };
}

export async function getDb() {
  if (!dbInstance) {
    try {
      console.log("Connecting to Supabase/Postgres...", {
        uriPreview: previewConnectionString(connectionString),
        sslMode,
      });

      await ensureSchema();
      dbInstance = {
        collection: createCollection,
      };
    } catch (err) {
      console.error("Supabase/Postgres connection error:", err);
      throw err;
    }
  }

  return dbInstance;
}