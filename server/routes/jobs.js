const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')
const { haversineDistance } = require('../utils/geo')

const router = express.Router()

router.use(requireAuth)

function requireCustomer(req, res) {
  if (String(req.user?.role || '').toLowerCase() !== 'customer') {
    res.status(403).json({ error: 'Only customers can access this resource.' })
    return false
  }

  return true
}

function requireWorker(req, res) {
  if (String(req.user?.role || '').toLowerCase() !== 'worker') {
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
      worker_profiles.trust_score,
      applied_workers.id AS application_id,
      applied_workers.status AS application_status,
      applied_workers.worker_name AS applied_worker_name,
      applied_workers.trust_score AS applied_trust_score,
      applied_workers.created_at AS applied_at,
      transactions.id AS transaction_id,
      transactions.worker_amount,
      transactions.welfare_amount,
      transactions.platform_amount,
      transactions.total_amount,
      transactions.credit_points_earned
    FROM job_matches
    JOIN users ON users.id = job_matches.worker_id
    JOIN worker_profiles ON worker_profiles.user_id = job_matches.worker_id
    LEFT JOIN applied_workers
      ON applied_workers.job_id = job_matches.job_id
      AND applied_workers.worker_id = job_matches.worker_id
    LEFT JOIN transactions ON transactions.job_id = job_matches.job_id
    WHERE job_matches.job_id = ?
    ORDER BY job_matches.score DESC
  `).all(jobId)
}

function normalizeJobWithTransaction(job) {
  if (!job) return job

  const creditPointsEarned = Number(job.credit_points_earned || 0)
  const transaction = job.transaction_id
    ? {
        id: job.transaction_id,
        job_id: job.job_id || job.id,
        worker_amount: job.worker_amount,
        welfare_amount: job.welfare_amount,
        platform_amount: job.platform_amount,
        total_amount: job.total_amount,
        credit_points_earned: creditPointsEarned,
      }
    : null

  const normalizedJob = { ...job }
  delete normalizedJob.transaction_id
  delete normalizedJob.worker_amount
  delete normalizedJob.welfare_amount
  delete normalizedJob.platform_amount
  delete normalizedJob.total_amount

  return { ...normalizedJob, credit_points_earned: creditPointsEarned, transaction }
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
        applied_workers.status AS application_status,
        users.name AS customer_name,
        users.phone AS customer_phone,
        transactions.id AS transaction_id,
        transactions.worker_amount,
        transactions.welfare_amount,
        transactions.platform_amount,
        transactions.total_amount,
        transactions.credit_points_earned
      FROM job_matches
      JOIN jobs ON jobs.id = job_matches.job_id
      JOIN users ON users.id = jobs.customer_id
      LEFT JOIN applied_workers
        ON applied_workers.job_id = jobs.id
        AND applied_workers.worker_id = job_matches.worker_id
      LEFT JOIN transactions ON transactions.job_id = jobs.id
      WHERE job_matches.worker_id = ?
        AND (job_matches.status IN ('offered', 'accepted') OR jobs.status = 'completed')
      ORDER BY jobs.created_at DESC, jobs.id DESC
    `).all(req.user.id).map((job) => normalizeJobWithTransaction(job))

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

      db.prepare(`
        INSERT INTO applied_workers (job_id, worker_id, worker_name, trust_score)
        SELECT jobs.id, users.id, users.name, worker_profiles.trust_score
        FROM jobs
        JOIN users ON users.id = ?
        JOIN worker_profiles ON worker_profiles.user_id = users.id
        WHERE jobs.id = ?
        ON CONFLICT(job_id, worker_id) DO NOTHING
      `).run(req.user.id, job.id)

      return {
        job,
        application: db.prepare(`
          SELECT applied_workers.*, users.phone AS worker_phone
          FROM applied_workers
          JOIN users ON users.id = applied_workers.worker_id
          WHERE applied_workers.job_id = ? AND applied_workers.worker_id = ?
        `).get(job.id, req.user.id),
      }
    })()

    if (!result) {
      return res.status(409).json({ error: 'This job is no longer available to accept.' })
    }

    emitToUser(req, result.job.customer_id, 'worker-applied', {
      job: result.job,
      application: result.application,
    })

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

router.post('/:id/hire', (req, res, next) => {
  try {
    if (!requireCustomer(req, res)) return

    const workerId = Number(req.body?.worker_id)
    if (!Number.isInteger(workerId)) {
      return res.status(400).json({ error: 'A worker is required.' })
    }

    const result = db.transaction(() => {
      const job = db.prepare(`
        SELECT * FROM jobs
        WHERE id = ? AND customer_id = ? AND status = 'matched'
      `).get(req.params.id, req.user.id)

      if (!job) return null

      const application = db.prepare(`
        SELECT applied_workers.*, users.phone AS worker_phone
        FROM applied_workers
        JOIN users ON users.id = applied_workers.worker_id
        WHERE applied_workers.job_id = ?
          AND applied_workers.worker_id = ?
          AND applied_workers.status = 'applied'
      `).get(job.id, workerId)

      if (!application) return null

      db.prepare("UPDATE jobs SET status = 'accepted' WHERE id = ?").run(job.id)
      db.prepare("UPDATE job_matches SET status = 'accepted' WHERE job_id = ? AND worker_id = ?").run(job.id, workerId)
      db.prepare("UPDATE job_matches SET status = 'rejected' WHERE job_id = ? AND worker_id != ? AND status = 'offered'").run(job.id, workerId)
      db.prepare("UPDATE applied_workers SET status = 'hired' WHERE job_id = ? AND worker_id = ?").run(job.id, workerId)
      db.prepare("UPDATE applied_workers SET status = 'dismissed' WHERE job_id = ? AND worker_id != ? AND status = 'applied'").run(job.id, workerId)
      db.prepare('UPDATE worker_profiles SET available = 0 WHERE user_id = ?').run(workerId)

      return {
        job: db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id),
        match: db.prepare('SELECT * FROM job_matches WHERE job_id = ? AND worker_id = ?').get(job.id, workerId),
        application,
        matches: getJobMatches(job.id),
        dismissedWorkerIds: db.prepare(`
          SELECT worker_id FROM applied_workers
          WHERE job_id = ? AND status = 'dismissed'
        `).all(job.id).map((entry) => entry.worker_id),
      }
    })()

    if (!result) {
      return res.status(409).json({ error: 'This worker application is no longer available.' })
    }

    emitToUser(req, workerId, 'worker-hired', {
      job: result.job,
      match: result.match,
    })
    emitToUser(req, result.job.customer_id, 'job-accepted', {
      job: result.job,
      match: result.match,
    })
    result.dismissedWorkerIds.forEach((dismissedWorkerId) => {
      emitToUser(req, dismissedWorkerId, 'worker-application-dismissed', { job: result.job })
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

      const rawCreditPoints = (totalAmount - 300) / 100 + 5
      const creditPointsEarned = Number(Math.min(7, Math.max(5, rawCreditPoints)).toFixed(2))

      const workerProfile = db.prepare('SELECT credit_points, loan_eligible FROM worker_profiles WHERE user_id = ?').get(req.user.id) || { credit_points: 0, loan_eligible: 0 }
      const currentCreditPoints = Number(workerProfile.credit_points || 0)
      const updatedCreditPoints = currentCreditPoints + creditPointsEarned
      const updatedLoanEligible = updatedCreditPoints >= 500 ? 1 : 0

      const transactionResult = db.prepare(`
        INSERT INTO transactions (job_id, worker_amount, welfare_amount, platform_amount, total_amount, credit_points_earned)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(job.id, workerAmount, welfareAmount, platformAmount, totalAmount, creditPointsEarned)

      db.prepare("UPDATE jobs SET status = 'completed' WHERE id = ?").run(job.id)
      db.prepare(`
        UPDATE worker_profiles
        SET available = 1,
            credit_points = ?,
            loan_eligible = ?
        WHERE user_id = ?
      `).run(updatedCreditPoints, updatedLoanEligible, req.user.id)

      const refreshedProfile = db.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(req.user.id)

      return {
        job: db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id),
        transaction: db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionResult.lastInsertRowid),
        profile: refreshedProfile,
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

    const job = db.prepare(`
      SELECT jobs.*, transactions.id AS transaction_id, transactions.worker_amount, transactions.welfare_amount,
             transactions.platform_amount, transactions.total_amount, transactions.credit_points_earned
      FROM jobs
      LEFT JOIN transactions ON transactions.job_id = jobs.id
      WHERE jobs.id = ? AND jobs.customer_id = ?
    `).get(req.params.id, req.user.id)

    if (!job) {
      return res.status(404).json({ error: 'Job not found.' })
    }

    return res.json({ job: normalizeJobWithTransaction(job), matches: getJobMatches(job.id) })
  } catch (error) {
    return next(error)
  }
})

router.get('/mine', (req, res, next) => {
  try {
    if (!requireCustomer(req, res)) return

    const jobs = db.prepare(`
      SELECT
        jobs.*,
        transactions.id AS transaction_id,
        transactions.worker_amount,
        transactions.welfare_amount,
        transactions.platform_amount,
        transactions.total_amount,
        transactions.credit_points_earned
      FROM jobs
      LEFT JOIN transactions ON transactions.job_id = jobs.id
      WHERE jobs.customer_id = ?
      ORDER BY jobs.created_at DESC, jobs.id DESC
    `).all(req.user.id).map((job) => normalizeJobWithTransaction(job))

    return res.json({ jobs })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
