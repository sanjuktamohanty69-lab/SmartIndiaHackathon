import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'

function WorkerDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const normalizedRole = String(user?.role || '').toLowerCase()
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyJobId, setBusyJobId] = useState(null)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return undefined
    }

    if (normalizedRole !== 'worker') {
      navigate('/login')
      return undefined
    }

    return undefined
  }, [user, normalizedRole, navigate])

  const fetchJobs = useCallback(async () => {
    try {
      const { data } = await client.get('/jobs/offered-to-me')
      setJobs((currentJobs) => {
        const settledJobs = currentJobs.filter((job) => job.status === 'completed' && job.transaction)
        const activeJobIds = new Set(data.jobs.map((job) => job.id))
        return [...data.jobs, ...settledJobs.filter((job) => !activeJobIds.has(job.id))]
      })
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load your job offers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
    const intervalId = window.setInterval(fetchJobs, 1500)
    return () => window.clearInterval(intervalId)
  }, [fetchJobs])

  useEffect(() => {
    if (!user?.id) return undefined

    const socket = io({
      auth: { userId: user.id },
    })

    socket.on('new-job-offer', () => {
      fetchJobs()
    })

    return () => socket.disconnect()
  }, [user?.id, fetchJobs])

  async function updateJob(jobId, action) {
    setBusyJobId(jobId)
    setError('')

    try {
      const { data } = await client.post(`/jobs/${jobId}/${action}`)

      if (action === 'complete') {
        setJobs((currentJobs) => currentJobs.map((job) => (
          job.id === jobId ? { ...job, ...data.job, transaction: data.transaction } : job
        )))
      } else {
        await fetchJobs()
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || `Unable to ${action} this job.`)
    } finally {
      setBusyJobId(null)
    }
  }

  const getJobCreditPoints = (job) => Number(job?.credit_points_earned ?? job?.transaction?.credit_points_earned ?? 0)
  const totalEarned = jobs.reduce((sum, currentJob) => sum + Number(currentJob.transaction?.total_amount || 0), 0)
  const totalCreditPoints = jobs.reduce((sum, currentJob) => sum + getJobCreditPoints(currentJob), 0)
  const paymentHistory = jobs.filter((job) => job.transaction).sort((first, second) => second.id - first.id)
  const loanReady = totalCreditPoints >= 500

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 transition-colors duration-200 sm:px-6 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">SahakarWorks</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">Worker dashboard</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">Welcome back, {user?.name || 'worker'}.</p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button className="text-sm font-semibold text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-emerald-400" type="button" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </header>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-colors duration-200 dark:bg-slate-900 dark:ring-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total earned</p>
            <p className="mt-2 text-2xl font-bold text-primary">₹{totalEarned.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-colors duration-200 dark:bg-slate-900 dark:ring-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Points & credits</p>
            <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-300">{totalCreditPoints.toFixed(0)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-colors duration-200 dark:bg-slate-900 dark:ring-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Loan readiness</p>
            <p className={`mt-2 text-lg font-bold ${loanReady ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}>
              {loanReady ? 'Eligible' : `${Math.max(0, 500 - totalCreditPoints).toFixed(0)} pts to qualify`}
            </p>
          </div>
        </div>

        {error && <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <section className="rounded-2xl bg-white p-6 shadow-xl shadow-emerald-950/5 ring-1 ring-slate-200 transition-colors duration-200 sm:p-8 dark:bg-slate-900 dark:ring-slate-700">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Available work</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Review nearby requests and keep your status up to date.</p>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">Refreshes every 5 seconds</span>
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-slate-500">Loading job offers...</p>
          ) : jobs.length ? (
            <div className="mt-6 grid gap-4">
              {jobs.map((job) => (
                <article className="rounded-xl border border-slate-200 p-5" key={job.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold capitalize text-slate-900">{job.trade}</h3>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                          {job.match_status || job.status}
                        </span>
                      </div>
                      <p className="mt-2 text-slate-700">{job.description}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {Number(job.distance_km).toFixed(2)} km away · Customer: {job.customer_name}
                      </p>
                    </div>

                    {job.transaction ? (
                      <div className="min-w-64 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/70">
                        <p className="font-bold text-emerald-900 dark:text-emerald-200">Payment Settled</p>
                        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">Total ₹{Number(job.transaction.total_amount).toFixed(2)}</p>
                        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-lg bg-white/70 p-2 dark:bg-slate-800/70"><dt className="text-slate-500 dark:text-slate-300">Worker 95%</dt><dd className="mt-1 font-bold text-emerald-900 dark:text-emerald-200">₹{Number(job.transaction.worker_amount).toFixed(2)}</dd></div>
                          <div className="rounded-lg bg-white/70 p-2 dark:bg-slate-800/70"><dt className="text-slate-500 dark:text-slate-300">Welfare 3%</dt><dd className="mt-1 font-bold text-emerald-900 dark:text-emerald-200">₹{Number(job.transaction.welfare_amount).toFixed(2)}</dd></div>
                          <div className="rounded-lg bg-white/70 p-2 dark:bg-slate-800/70"><dt className="text-slate-500 dark:text-slate-300">Platform 2%</dt><dd className="mt-1 font-bold text-emerald-900 dark:text-emerald-200">₹{Number(job.transaction.platform_amount).toFixed(2)}</dd></div>
                        </dl>
                        <div className="mt-3 rounded-lg bg-white/70 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-slate-800/70 dark:text-amber-300">
                          Points earned: {getJobCreditPoints(job).toFixed(0)} credits
                        </div>
                      </div>
                    ) : job.match_status === 'offered' ? (
                      <div className="flex shrink-0 gap-3">
                        <button
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          type="button"
                          disabled={busyJobId === job.id}
                          onClick={() => updateJob(job.id, 'reject')}
                        >
                          Reject
                        </button>
                        <button
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          type="button"
                          disabled={busyJobId === job.id}
                          onClick={() => updateJob(job.id, 'accept')}
                        >
                          Accept
                        </button>
                      </div>
                    ) : job.match_status === 'accepted' ? (
                      <button
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        type="button"
                        disabled={busyJobId === job.id}
                        onClick={() => updateJob(job.id, 'complete')}
                      >
                        {busyJobId === job.id ? 'Settling...' : 'Complete Job'}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              No job offers yet. New requests will appear here automatically.
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recent transactions</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Payment split history</span>
          </div>

          {paymentHistory.length ? (
            <div className="mt-4 space-y-3">
              {paymentHistory.map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 capitalize">{job.trade}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{job.status === 'completed' ? 'Completed job' : job.match_status}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">₹{Number(job.transaction.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Worker</p>
                      <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">₹{Number(job.transaction.worker_amount).toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Welfare</p>
                      <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">₹{Number(job.transaction.welfare_amount).toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Platform</p>
                      <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">₹{Number(job.transaction.platform_amount).toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Credits</p>
                      <p className="mt-1 font-semibold text-violet-700 dark:text-violet-300">{getJobCreditPoints(job).toFixed(0)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No transaction history yet. Completed jobs will appear here.</p>
          )}
        </section>
      </div>
    </main>
  )
}

export default WorkerDashboard
