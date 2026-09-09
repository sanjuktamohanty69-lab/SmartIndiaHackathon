const bcrypt = require('bcryptjs')
const db = require('./db')

const defaultPassword = 'password123'
const passwordHash = bcrypt.hashSync(defaultPassword, 10)

const customers = [
  { name: 'Ramesh', phone: '9000000001' },
  { name: 'Priya', phone: '9000000002' },
  { name: 'Ananya', phone: '9000000003' },
]

const workers = [
  { name: 'Suresh Kumar', phone: '9000000011', trade: 'plumber', trustScore: 98 },
  { name: 'Meena Devi', phone: '9000000012', trade: 'electrician', trustScore: 95 },
  { name: 'Arjun Rao', phone: '9000000013', trade: 'carpenter', trustScore: 92 },
  { name: 'Lakshmi N', phone: '9000000014', trade: 'plumber', trustScore: 90 },
  { name: 'Vijay Singh', phone: '9000000015', trade: 'electrician', trustScore: 88 },
]

const insertUser = db.prepare(`
  INSERT INTO users (name, phone, password, role)
  VALUES (?, ?, ?, ?)
`)

const insertWorkerProfile = db.prepare(`
  INSERT INTO worker_profiles (user_id, trade, lat, lng, trust_score, available, eshram_verified)
  VALUES (?, ?, ?, ?, ?, 1, 1)
`)

const seed = db.transaction(() => {
  const existingUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get()

  if (existingUsers.count > 0) {
    return false
  }

  for (const customer of customers) {
    insertUser.run(customer.name, customer.phone, passwordHash, 'customer')
  }

  for (const worker of workers) {
    const result = insertUser.run(worker.name, worker.phone, passwordHash, 'worker')
    insertWorkerProfile.run(result.lastInsertRowid, worker.trade, 12.9716, 77.5946, worker.trustScore)
  }

  insertUser.run('Admin Sahakar', '9999999999', passwordHash, 'admin')
  return true
})

if (seed()) {
  console.log('Seed data inserted successfully.')
} else {
  console.log('Users already exist. Skipping seed data.')
}

db.close()
