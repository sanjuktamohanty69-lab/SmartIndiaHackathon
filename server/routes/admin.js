const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

router.use(requireAuth)
router.use((req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access is required.' })
  }

  return next()
})

router.get('/stats', (req, res, next) => {
  try {
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM jobs) AS total_jobs,
        (SELECT COALESCE(SUM(total_amount), 0) FROM transactions) AS total_transaction_volume,
        (SELECT COUNT(*) FROM worker_profiles WHERE available = 1) AS active_workers,
        (SELECT COUNT(*) FROM disputes WHERE status = 'open') AS open_disputes
    `).get()

    return res.json({ stats })
  } catch (error) {
    return next(error)
  }
})

router.get('/workers', (req, res, next) => {
  try {
    const workers = db.prepare(`
      SELECT
        users.id,
        users.name,
        users.phone,
        worker_profiles.trade,
        worker_profiles.trust_score,
        worker_profiles.available,
        worker_profiles.eshram_verified
      FROM users
      JOIN worker_profiles ON worker_profiles.user_id = users.id
      WHERE users.role = 'worker'
      ORDER BY worker_profiles.trust_score DESC, users.name ASC
    `).all()

    return res.json({ workers })
  } catch (error) {
    return next(error)
  }
})

router.get('/disputes', (req, res, next) => {
  try {
    const disputes = db.prepare(`
      SELECT
        disputes.id,
        disputes.job_id,
        disputes.raised_by,
        disputes.reason,
        disputes.status,
        disputes.resolution,
        disputes.created_at,
        jobs.trade,
        jobs.description,
        jobs.status AS job_status,
        customer.name AS customer_name,
        raiser.name AS raised_by_name,
        COUNT(dispute_votes.id) AS vote_count
      FROM disputes
      JOIN jobs ON jobs.id = disputes.job_id
      JOIN users AS customer ON customer.id = jobs.customer_id
      JOIN users AS raiser ON raiser.id = disputes.raised_by
      LEFT JOIN dispute_votes ON dispute_votes.dispute_id = disputes.id
      WHERE disputes.status = 'open'
      GROUP BY disputes.id
      ORDER BY disputes.created_at ASC, disputes.id ASC
    `).all()

    return res.json({ disputes })
  } catch (error) {
    return next(error)
  }
})

router.post('/disputes/:id/vote', (req, res, next) => {
  try {
    const { vote } = req.body

    if (!['favor_customer', 'favor_worker'].includes(vote)) {
      return res.status(400).json({ error: 'Vote must favor_customer or favor_worker.' })
    }

    const result = db.transaction(() => {
      const dispute = db.prepare("SELECT * FROM disputes WHERE id = ? AND status = 'open'").get(req.params.id)

      if (!dispute) return null

      db.prepare(`
        INSERT INTO dispute_votes (dispute_id, juror_id, vote)
        VALUES (?, ?, ?)
      `).run(dispute.id, req.user.id, vote)

      const votes = db.prepare(`
        SELECT vote, COUNT(*) AS count
        FROM dispute_votes
        WHERE dispute_id = ?
        GROUP BY vote
      `).all(dispute.id)
      const totalVotes = votes.reduce((sum, item) => sum + item.count, 0)
      const customerVotes = votes.find((item) => item.vote === 'favor_customer')?.count || 0
      const workerVotes = votes.find((item) => item.vote === 'favor_worker')?.count || 0
      let resolution = null

      if (totalVotes >= 3) {
        resolution = customerVotes > workerVotes
          ? 'favor_customer'
          : 'favor_worker'
        db.prepare("UPDATE disputes SET status = 'resolved', resolution = ? WHERE id = ?").run(resolution, dispute.id)
      }

      return {
        dispute: db.prepare('SELECT * FROM disputes WHERE id = ?').get(dispute.id),
        voteCount: totalVotes,
        resolution,
      }
    })()

    if (!result) {
      return res.status(404).json({ error: 'Open dispute not found.' })
    }

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

module.exports = router
