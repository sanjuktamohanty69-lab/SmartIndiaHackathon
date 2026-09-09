const jwt = require('jsonwebtoken')

const jwtSecret = process.env.JWT_SECRET || 'sahakarworks-prototype-secret'

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization
  const token = authorization && authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : null

  if (!token) {
    return res.status(401).json({ error: 'Authentication token is required.' })
  }

  try {
    req.user = jwt.verify(token, jwtSecret)
    return next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' })
  }
}

module.exports = { requireAuth }
