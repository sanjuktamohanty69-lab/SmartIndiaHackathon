const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../db')

const router = express.Router()
const jwtSecret = process.env.JWT_SECRET || 'sahakarworks-prototype-secret'

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.name,
    },
    jwtSecret,
    { expiresIn: '7d' },
  )
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
  }
}

router.post('/signup', async (req, res, next) => {
  try {
    const { name, phone, password, role, trade, lat, lng } = req.body || {}
    const normalizedName = typeof name === 'string' ? name.trim() : ''
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : ''
    const normalizedPassword = typeof password === 'string' ? password : ''
    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : ''
    const normalizedTrade = typeof trade === 'string' ? trade.trim() : ''

    if (!normalizedName || !normalizedPhone || !normalizedPassword || !normalizedRole) {
      return res.status(400).json({ error: 'Name, phone, password, and role are required.' })
    }

    if (normalizedPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' })
    }

    if (!['customer', 'worker'].includes(normalizedRole)) {
      return res.status(400).json({ error: 'Role must be customer or worker.' })
    }

    if (normalizedRole === 'worker' && !normalizedTrade) {
      return res.status(400).json({ error: 'Trade is required for workers.' })
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE phone = ?').get(normalizedPhone)

    if (existingUser) {
      return res.status(409).json({ error: 'A user with this phone number already exists.' })
    }

    let passwordHash
    try {
      passwordHash = await bcrypt.hash(normalizedPassword, 10)
    } catch (error) {
      console.error('Password hashing failed during signup:', error)
      return res.status(500).json({
        error: 'We could not secure your password. Please try again later.',
        code: 'PASSWORD_HASH_FAILED',
      })
    }

    const createUser = db.transaction(() => {
      const result = db
        .prepare('INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)')
        .run(normalizedName, normalizedPhone, passwordHash, normalizedRole)
      const userId = Number(result.lastInsertRowid)

      if (normalizedRole === 'worker') {
        db.prepare(`
          INSERT INTO worker_profiles (user_id, trade, lat, lng)
          VALUES (?, ?, ?, ?)
        `).run(userId, normalizedTrade, lat ?? 12.9716, lng ?? 77.5946)
      }

      return db.prepare('SELECT id, name, phone, role FROM users WHERE id = ?').get(userId)
    })()

    const user = publicUser(createUser)
    return res.status(201).json({ user, token: createToken(user) })
  } catch (error) {
    console.error('Signup failed:', error)

    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A user with this phone number already exists.' })
    }

    return res.status(500).json({
      error: 'Unable to create your account. Please try again later.',
      code: error.code || 'SIGNUP_FAILED',
      details: error.message,
    })
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required.' })
    }

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone)
    const passwordMatches = user && (await bcrypt.compare(password, user.password))

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid phone or password.' })
    }

    const safeUser = publicUser(user)
    return res.json({ user: safeUser, token: createToken(safeUser) })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
