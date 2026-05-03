import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  "";

if (!connectionString) {
  console.warn("No Postgres URL configured. Set DATABASE_URL (or SUPABASE_DB_URL/POSTGRES_URL).");
}

let pool;

function getPool() {
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL for Postgres connection.");
  }

  if (!pool) {
    const useSsl = String(process.env.PG_SSL || "true").toLowerCase() !== "false";
    pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  return pool;
}

export async function initPostgres() {
  const p = getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      full_name TEXT NOT NULL DEFAULT '',
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      user_type TEXT NOT NULL DEFAULT 'student',
      avatar TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS scholarships (
      id BIGSERIAL PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function dbPing() {
  const p = getPool();
  await p.query("SELECT 1");
}

export async function listScholarships() {
  const p = getPool();
  const { rows } = await p.query(
    "SELECT id, data FROM scholarships ORDER BY created_at DESC"
  );

  return rows.map((row) => ({
    id: row.id,
    ...(row.data || {}),
  }));
}

export async function createScholarship(payload) {
  const p = getPool();
  const { rows } = await p.query(
    "INSERT INTO scholarships (data) VALUES ($1::jsonb) RETURNING id",
    [JSON.stringify(payload ?? {})]
  );
  return rows[0]?.id;
}

export async function findUserByEmail(email) {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT full_name, email, password, phone, user_type, avatar
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  if (!rows[0]) {
    return null;
  }

  const row = rows[0];
  return {
    fullName: row.full_name || "",
    email: row.email,
    password: row.password,
    phone: row.phone || "",
    userType: row.user_type || "student",
    avatar: row.avatar || "",
  };
}

export async function createUser(user) {
  const p = getPool();
  await p.query(
    `INSERT INTO users (full_name, email, password, phone, user_type, avatar)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      user.fullName || "",
      user.email,
      user.password,
      user.phone || "",
      user.userType || "student",
      user.avatar || "",
    ]
  );
}

export async function createSession(token, email) {
  const p = getPool();
  await p.query(
    "INSERT INTO sessions (token, email) VALUES ($1, $2)",
    [token, email]
  );
}
