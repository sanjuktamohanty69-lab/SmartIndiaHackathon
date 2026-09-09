import { useEffect, useState } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'

const tabs = ['Overview', 'Workers', 'Disputes']

function MetricCard({ label, value, accent }) {
  return (
    <article className="rounded-2xl bg-white p-6 shadow-xl shadow-emerald-950/5 ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${accent ? 'text-primary' : 'text-slate-900'}`}>{value}</p>
    </article>
  )
}

function AdminDashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('Overview')
  const [stats, setStats] = useState(null)
  const [workers, setWorkers] = useState([])
  const [disputes, setDisputes] = useState([])
  const [error, setError] = useState('')

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
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">SahakarWorks Admin</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Operations dashboard</h1>
            <p className="mt-2 text-slate-600">Welcome, {user?.name || 'Admin'}. Monitor the network and resolve disputes.</p>
          </div>
          <button className="text-sm font-semibold text-slate-600 hover:text-primary" type="button" onClick={logout}>Sign out</button>
        </header>

        <nav className="mb-6 flex gap-2 border-b border-slate-200" aria-label="Admin sections">
          {tabs.map((tab) => (
            <button
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
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
          <section className="overflow-hidden rounded-2xl bg-white shadow-xl shadow-emerald-950/5 ring-1 ring-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-6 py-4">Worker</th><th className="px-6 py-4">Trade</th><th className="px-6 py-4">Trust score</th><th className="px-6 py-4">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workers.map((worker) => (
                    <tr key={worker.id}>
                      <td className="px-6 py-4"><p className="font-semibold text-slate-900">{worker.name}</p><p className="text-slate-500">{worker.phone}</p></td>
                      <td className="px-6 py-4 capitalize text-slate-700">{worker.trade}</td>
                      <td className="px-6 py-4 font-semibold text-primary">{Math.round(worker.trust_score)}%</td>
                      <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${worker.available ? 'bg-emerald-50 text-primary' : 'bg-slate-100 text-slate-500'}`}>{worker.available ? 'Available' : 'Busy'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'Disputes' && (
          <section className="space-y-4">
            {disputes.length ? disputes.map((dispute) => (
              <article className="rounded-2xl bg-white p-6 shadow-xl shadow-emerald-950/5 ring-1 ring-slate-200" key={dispute.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-primary">Dispute #{dispute.id} · {dispute.trade}</p>
                    <h2 className="mt-2 text-lg font-bold text-slate-900">{dispute.description}</h2>
                    <p className="mt-2 text-slate-600">{dispute.reason}</p>
                    <p className="mt-2 text-sm text-slate-500">Raised by {dispute.raised_by_name} for customer {dispute.customer_name}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">{dispute.vote_count}/3 votes</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" type="button" onClick={() => castVote(dispute.id, 'favor_customer')}>Peer favors customer</button>
                  <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary" type="button" onClick={() => castVote(dispute.id, 'favor_worker')}>Peer favors worker</button>
                </div>
              </article>
            )) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No open disputes.</div>}
          </section>
        )}
      </div>
    </main>
  )
}

export default AdminDashboard
