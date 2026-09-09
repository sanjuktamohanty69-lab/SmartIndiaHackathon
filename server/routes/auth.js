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
    const { name, phone, password, role, trade, lat, lng } = req.body

    if (!name || !phone || !password || !role) {
      return res.status(400).json({ error: 'Name, phone, password, and role are required.' })
    }

    if (!['customer', 'worker'].includes(role)) {
      return res.status(400).json({ error: 'Role must be customer or worker.' })
    }

    if (role === 'worker' && !trade) {
      return res.status(400).json({ error: 'Trade is required for workers.' })
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)

    if (existingUser) {
      return res.status(409).json({ error: 'A user with this phone number already exists.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const createUser = db.transaction(() => {
      const result = db
        .prepare('INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)')
        .run(name, phone, passwordHash, role)
      const userId = Number(result.lastInsertRowid)

      if (role === 'worker') {
        db.prepare(`
          INSERT INTO worker_profiles (user_id, trade, lat, lng)
          VALUES (?, ?, ?, ?)
        `).run(userId, trade, lat ?? 12.9716, lng ?? 77.5946)
      }

      return db.prepare('SELECT id, name, phone, role FROM users WHERE id = ?').get(userId)
    })()

    const user = publicUser(createUser)
    return res.status(201).json({ user, token: createToken(user) })
  } catch (error) {
    return next(error)
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
