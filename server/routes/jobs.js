const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')
const { haversineDistance } = require('../utils/geo')

const router = express.Router()

router.use(requireAuth)

function requireCustomer(req, res) {
  if (req.user.role !== 'customer') {
    res.status(403).json({ error: 'Only customers can access this resource.' })
    return false
  }

  return true
}

function requireWorker(req, res) {
  if (req.user.role !== 'worker') {
    res.status(403).json({ error: 'Only workers can access this resource.' })
    return false
  }

  return true
}

function getJobMatches(jobId) {
  return db.prepare(`
    SELECT
      job_matches.id,
      job_matches.job_id,
      job_matches.worker_id,
      job_matches.distance_km,
      job_matches.score,
      job_matches.status,
      users.name AS worker_name,
      users.phone AS worker_phone,
      worker_profiles.trade,
      worker_profiles.trust_score
    FROM job_matches
    JOIN users ON users.id = job_matches.worker_id
    JOIN worker_profiles ON worker_profiles.user_id = job_matches.worker_id
    WHERE job_matches.job_id = ?
    ORDER BY job_matches.score DESC
  `).all(jobId)
}

function emitToUser(req, userId, event, payload) {
  const io = req.app.get('io')
  const userSockets = req.app.get('userSockets')
  const sockets = userSockets?.get(String(userId))

  sockets?.forEach((socketId) => io.to(socketId).emit(event, payload))
}

router.post('/', (req, res, next) => {
  try {
    if (!requireCustomer(req, res)) return

    const { trade, description, lat, lng } = req.body
    const jobLat = Number(lat)
    const jobLng = Number(lng)

    if (!trade || !description || !Number.isFinite(jobLat) || !Number.isFinite(jobLng)) {
      return res.status(400).json({ error: 'Trade, description, lat, and lng are required.' })
    }

    const result = db.transaction(() => {
      const jobResult = db.prepare(`
        INSERT INTO jobs (customer_id, trade, description, lat, lng, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).run(req.user.id, trade, description, jobLat, jobLng)
      const jobId = Number(jobResult.lastInsertRowid)

      const workers = db.prepare(`
        SELECT users.id AS worker_id, worker_profiles.lat, worker_profiles.lng, worker_profiles.trust_score
        FROM users
        JOIN worker_profiles ON worker_profiles.user_id = users.id
        WHERE users.role = 'worker'
          AND worker_profiles.trade = ?
          AND worker_profiles.available = 1
      `).all(trade)

      const rankedWorkers = workers
        .map((worker) => {
          const distanceKm = haversineDistance(jobLat, jobLng, worker.lat, worker.lng)
          const score = (1 / (distanceKm + 0.1)) * (worker.trust_score / 100)

          return { ...worker, distanceKm, score }
        })
        .sort((first, second) => second.score - first.score)
        .slice(0, 3)

      const insertMatch = db.prepare(`
        INSERT INTO job_matches (job_id, worker_id, distance_km, score, status)
        VALUES (?, ?, ?, ?, 'offered')
      `)

      for (const worker of rankedWorkers) {
        insertMatch.run(jobId, worker.worker_id, worker.distanceKm, worker.score)
      }

      db.prepare("UPDATE jobs SET status = 'matched' WHERE id = ?").run(jobId)

      return {
        job: db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId),
        matches: getJobMatches(jobId),
      }
    })()

    result.matches.forEach((match) => {
      emitToUser(req, match.worker_id, 'new-job-offer', {
        job: result.job,
        match,
      })
    })

    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
})

router.get('/offered-to-me', (req, res, next) => {
  try {
    if (!requireWorker(req, res)) return

    const jobs = db.prepare(`
      SELECT
        jobs.*,
        job_matches.id AS match_id,
        job_matches.distance_km,
        job_matches.score,
        job_matches.status AS match_status,
        users.name AS customer_name,
        users.phone AS customer_phone
      FROM job_matches
      JOIN jobs ON jobs.id = job_matches.job_id
      JOIN users ON users.id = jobs.customer_id
      WHERE job_matches.worker_id = ?
        AND job_matches.status IN ('offered', 'accepted')
      ORDER BY jobs.created_at DESC, jobs.id DESC
    `).all(req.user.id)

    return res.json({ jobs })
  } catch (error) {
    return next(error)
  }
})

router.post('/:id/accept', (req, res, next) => {
  try {
    if (!requireWorker(req, res)) return

    const result = db.transaction(() => {
      const match = db.prepare(`
        SELECT * FROM job_matches
        WHERE job_id = ? AND worker_id = ? AND status = 'offered'
      `).get(req.params.id, req.user.id)

      if (!match) return null

      const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND status = 'matched'").get(req.params.id)

      if (!job) return null

      db.prepare("UPDATE job_matches SET status = 'accepted' WHERE id = ?").run(match.id)
      db.prepare("UPDATE jobs SET status = 'accepted' WHERE id = ?").run(job.id)
      db.prepare('UPDATE worker_profiles SET available = 0 WHERE user_id = ?').run(req.user.id)

      return {
        job: db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id),
        match: db.prepare('SELECT * FROM job_matches WHERE id = ?').get(match.id),
      }
    })()

    if (!result) {
      return res.status(409).json({ error: 'This job is no longer available to accept.' })
    }

    emitToUser(req, result.job.customer_id, 'job-accepted', {
      job: result.job,
      match: result.match,
    })

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

router.post('/:id/reject', (req, res, next) => {
  try {
    if (!requireWorker(req, res)) return

    const result = db.prepare(`
      UPDATE job_matches
      SET status = 'rejected'
      WHERE job_id = ? AND worker_id = ? AND status = 'offered'
    `).run(req.params.id, req.user.id)

    if (!result.changes) {
      return res.status(404).json({ error: 'Offered job not found.' })
    }

    return res.json({ message: 'Job rejected.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/:id/complete', (req, res, next) => {
  try {
    if (!requireWorker(req, res)) return

    const result = db.transaction(() => {
      const job = db.prepare(`
        SELECT jobs.*
        FROM jobs
        JOIN job_matches ON job_matches.job_id = jobs.id
        WHERE jobs.id = ?
          AND jobs.status = 'accepted'
          AND job_matches.worker_id = ?
          AND job_matches.status = 'accepted'
      `).get(req.params.id, req.user.id)

      if (!job) return null

      const totalAmount = Math.floor(Math.random() * 501) + 300
      const workerAmount = Number((totalAmount * 0.95).toFixed(2))
      const welfareAmount = Number((totalAmount * 0.03).toFixed(2))
      const platformAmount = Number((totalAmount * 0.02).toFixed(2))
      const transactionResult = db.prepare(`
        INSERT INTO transactions (job_id, worker_amount, welfare_amount, platform_amount, total_amount)
        VALUES (?, ?, ?, ?, ?)
      `).run(job.id, workerAmount, welfareAmount, platformAmount, totalAmount)

      db.prepare("UPDATE jobs SET status = 'completed' WHERE id = ?").run(job.id)
      db.prepare('UPDATE worker_profiles SET available = 1 WHERE user_id = ?').run(req.user.id)

      return {
        job: db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id),
        transaction: db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionResult.lastInsertRowid),
      }
    })()

    if (!result) {
      return res.status(409).json({ error: 'Only an accepted job assigned to you can be completed.' })
    }

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

router.post('/:id/dispute', (req, res, next) => {
  try {
    const { reason } = req.body

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A dispute reason is required.' })
    }

    const result = db.transaction(() => {
      const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id)

      if (!job) return null

      const disputeResult = db.prepare(`
        INSERT INTO disputes (job_id, raised_by, reason, status)
        VALUES (?, ?, ?, 'open')
      `).run(job.id, req.user.id, reason.trim())

      db.prepare("UPDATE jobs SET status = 'disputed' WHERE id = ?").run(job.id)

      return db.prepare('SELECT * FROM disputes WHERE id = ?').get(disputeResult.lastInsertRowid)
    })()

    if (!result) {
      return res.status(404).json({ error: 'Job not found.' })
    }

    return res.status(201).json({ dispute: result })
  } catch (error) {
    return next(error)
  }
})

router.get('/:id/matches', (req, res, next) => {
  try {
    if (!requireCustomer(req, res)) return

    const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND customer_id = ?').get(req.params.id, req.user.id)

    if (!job) {
      return res.status(404).json({ error: 'Job not found.' })
    }

    return res.json({ job, matches: getJobMatches(job.id) })
  } catch (error) {
    return next(error)
  }
})

router.get('/mine', (req, res, next) => {
  try {
    if (!requireCustomer(req, res)) return

    const jobs = db.prepare(`
      SELECT * FROM jobs
      WHERE customer_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(req.user.id)

    return res.json({ jobs })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
