import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'

function WorkerDashboard() {
  const { user, logout } = useAuth()
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyJobId, setBusyJobId] = useState(null)

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
    const intervalId = window.setInterval(fetchJobs, 5000)
    return () => window.clearInterval(intervalId)
  }, [fetchJobs])

  useEffect(() => {
    if (!user?.id) return undefined

    const socket = io('http://localhost:5000', {
      auth: { userId: user.id },
    })

    socket.on('new-job-offer', (event) => {
      const trade = event.job?.trade || 'service'
      window.alert(`New ${trade} job offer available.`)
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">SahakarWorks</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Worker dashboard</h1>
            <p className="mt-2 text-slate-600">Welcome back, {user?.name || 'worker'}.</p>
          </div>
          <button className="text-sm font-semibold text-slate-600 hover:text-primary" type="button" onClick={logout}>
            Sign out
          </button>
        </header>

        {error && <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <section className="rounded-2xl bg-white p-6 shadow-xl shadow-emerald-950/5 ring-1 ring-slate-200 sm:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Available work</h2>
              <p className="mt-2 text-sm text-slate-600">Review nearby requests and keep your status up to date.</p>
            </div>
            <span className="text-sm text-slate-500">Refreshes every 5 seconds</span>
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
                      <div className="min-w-64 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                        <p className="font-bold text-emerald-900">Payment Settled</p>
                        <p className="mt-1 text-sm text-emerald-800">Total ₹{job.transaction.total_amount}</p>
                        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-lg bg-white/70 p-2"><dt className="text-slate-500">Worker 95%</dt><dd className="mt-1 font-bold text-emerald-900">₹{job.transaction.worker_amount}</dd></div>
                          <div className="rounded-lg bg-white/70 p-2"><dt className="text-slate-500">Welfare 3%</dt><dd className="mt-1 font-bold text-emerald-900">₹{job.transaction.welfare_amount}</dd></div>
                          <div className="rounded-lg bg-white/70 p-2"><dt className="text-slate-500">Platform 2%</dt><dd className="mt-1 font-bold text-emerald-900">₹{job.transaction.platform_amount}</dd></div>
                        </dl>
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
      </div>
    </main>
  )
}

export default WorkerDashboard
