import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import WorkerCard from '../components/WorkerCard'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import AppHeader from '../components/AppHeader'

const tabs = ['Overview', 'Workers', 'Disputes']

function MetricCard({ label, value, accent }) {
  return (
    <article className="rounded-2xl bg-white p-6 shadow-xl shadow-emerald-950/5 ring-1 ring-slate-200 transition-colors duration-200 dark:bg-slate-900 dark:ring-slate-700">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${accent ? 'text-primary' : 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
    </article>
  )
}

function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Overview')
  const [stats, setStats] = useState(null)
  const [workers, setWorkers] = useState([])
  const [disputes, setDisputes] = useState([])
  const [error, setError] = useState('')

  function handleLogout() {
    logout()
    navigate('/login')
  }

  async function loadStats() {
    const { data } = await client.get('/admin/stats')
    setStats(data.stats)
  }

  async function loadWorkers() {
    const { data } = await client.get('/admin/workers')
    setWorkers(data.workers)
  }

  async function loadDisputes() {
    const { data } = await client.get('/admin/disputes')
    setDisputes(data.disputes)
  }

  async function loadDashboard() {
    try {
      setError('')
      await Promise.all([loadStats(), loadWorkers(), loadDisputes()])
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load the admin dashboard.')
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  async function castVote(disputeId, vote) {
    try {
      setError('')
      const { data } = await client.post(`/admin/disputes/${disputeId}/vote`, { vote })

      if (data.dispute.status === 'resolved') {
        await Promise.all([loadDisputes(), loadStats()])
      } else {
        setDisputes((current) => current.map((dispute) => (
          dispute.id === disputeId ? { ...dispute, vote_count: data.voteCount } : dispute
        )))
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to record that vote.')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 transition-colors duration-200 sm:px-6 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <AppHeader
            title="Operations dashboard"
            subtitle={`Welcome, ${user?.name || 'Admin'}. Monitor the network and resolve disputes.`}
            badge="SahakarWorks Admin"
            actions={(
              <>
                <ThemeToggle />
                <button className="text-sm font-semibold text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-emerald-400" type="button" onClick={handleLogout}>Sign out</button>
              </>
            )}
          />
        </div>

        <nav className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-700" aria-label="Admin sections">
          {tabs.map((tab) => (
            <button
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        {error && <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {activeTab === 'Overview' && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total jobs" value={stats?.total_jobs ?? '—'} />
            <MetricCard label="Transaction volume" value={stats ? `₹${Number(stats.total_transaction_volume).toFixed(2)}` : '—'} accent />
            <MetricCard label="Active workers" value={stats?.active_workers ?? '—'} />
            <MetricCard label="Open disputes" value={stats?.open_disputes ?? '—'} />
          </section>
        )}

        {activeTab === 'Workers' && (
          <section className="grid gap-4 md:grid-cols-2">
            {workers.map((worker) => (
              <WorkerCard
                key={worker.id}
                name={worker.name}
                trade={worker.trade}
                trustScore={worker.trust_score}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${worker.available ? 'bg-emerald-50 text-primary dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {worker.available ? 'Available' : 'Busy'}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">{worker.phone}</span>
                </div>
              </WorkerCard>
            ))}
          </section>
        )}

        {activeTab === 'Disputes' && (
          <section className="space-y-4">
            {disputes.length ? disputes.map((dispute) => (
              <article className="rounded-2xl bg-white p-6 shadow-xl shadow-emerald-950/5 ring-1 ring-slate-200 transition-colors duration-200 dark:bg-slate-900 dark:ring-slate-700" key={dispute.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-primary">Dispute #{dispute.id} · {dispute.trade}</p>
                    <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{dispute.description}</h2>
                    <p className="mt-2 text-slate-600 dark:text-slate-300">{dispute.reason}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Raised by {dispute.raised_by_name} for customer {dispute.customer_name}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">{dispute.vote_count}/3 votes</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" type="button" onClick={() => castVote(dispute.id, 'favor_customer')}>Peer favors customer</button>
                  <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary dark:border-slate-600 dark:text-slate-200" type="button" onClick={() => castVote(dispute.id, 'favor_worker')}>Peer favors worker</button>
                </div>
              </article>
            )) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-600 dark:text-slate-400">No open disputes.</div>}
          </section>
        )}
      </div>
    </main>
  )
}

export default AdminDashboard
