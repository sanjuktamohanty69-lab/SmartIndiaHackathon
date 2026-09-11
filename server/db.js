const path = require('path')
const Database = require('better-sqlite3')

const db = new Database(path.join(__dirname, 'data.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('customer', 'worker', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS worker_profiles (
    user_id INTEGER PRIMARY KEY,
    trade TEXT,
    lat REAL,
    lng REAL,
    trust_score REAL DEFAULT 85.0,
    available INTEGER DEFAULT 1,
    eshram_verified INTEGER DEFAULT 1,
    credit_points REAL DEFAULT 0,
    loan_eligible INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    trade TEXT,
    description TEXT,
    lat REAL,
    lng REAL,
    status TEXT CHECK(status IN ('pending', 'matched', 'accepted', 'completed', 'disputed')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS job_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    worker_id INTEGER,
    distance_km REAL,
    score REAL,
    status TEXT CHECK(status IN ('offered', 'accepted', 'rejected')) DEFAULT 'offered',
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(worker_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    worker_amount REAL,
    welfare_amount REAL,
    platform_amount REAL,
    total_amount REAL,
    credit_points_earned REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS disputes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    raised_by INTEGER,
    reason TEXT,
    status TEXT CHECK(status IN ('open', 'resolved')) DEFAULT 'open',
    resolution TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(raised_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS dispute_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dispute_id INTEGER,
    juror_id INTEGER,
    vote TEXT,
    FOREIGN KEY(dispute_id) REFERENCES disputes(id),
    FOREIGN KEY(juror_id) REFERENCES users(id)
  );
`)

for (const statement of [
  'ALTER TABLE worker_profiles ADD COLUMN credit_points REAL DEFAULT 0',
  'ALTER TABLE worker_profiles ADD COLUMN loan_eligible INTEGER DEFAULT 0',
  'ALTER TABLE transactions ADD COLUMN credit_points_earned REAL DEFAULT 0',
]) {
  try {
    db.prepare(statement).run()
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error
    }
  }
}

module.exports = db
