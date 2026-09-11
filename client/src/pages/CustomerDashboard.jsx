import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import WorkerCard from '../components/WorkerCard'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import AppHeader from '../components/AppHeader'

const fallbackLocation = { lat: 12.9716, lng: 77.5946 }
const trades = ['plumber', 'electrician', 'carpenter', 'househelp']
const serviceOptions = [
  { value: 'plumber', label: 'Plumber', icon: '🔧', description: 'Fix leaks and repairs' },
  { value: 'electrician', label: 'Electrician', icon: '💡', description: 'Wiring and electrical fixes' },
  { value: 'carpenter', label: 'Carpenter', icon: '🪚', description: 'Furniture and woodwork' },
  { value: 'househelp', label: 'Househelp', icon: '🧹', description: 'Cleaning and household support' },
]
const steps = [
  { status: 'pending', label: 'Posted' },
  { status: 'matched', label: 'Matched' },
  { status: 'accepted', label: 'Worker En Route' },
  { status: 'completed', label: 'Completed' },
]

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(fallbackLocation)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(fallbackLocation),
      { timeout: 5000 },
    )
  })
}

function CustomerDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const recognitionRef = useRef(null)
  const normalizedRole = String(user?.role || '').toLowerCase()
  const [form, setForm] = useState({ trade: trades[0], description: '' })
  const [job, setJob] = useState(null)
  const [matches, setMatches] = useState([])
  const [paymentHistory, setPaymentHistory] = useState([])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hiringWorkerId, setHiringWorkerId] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const activeJobId = job?.id
  const jobStatus = job?.status

  function handleLogout() {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return undefined
    }

    if (normalizedRole !== 'customer') {
      navigate('/login')
      return undefined
    }

    return undefined
  }, [user, normalizedRole, navigate])

  useEffect(() => {
    if (!user?.id) return undefined

    const loadHistory = async () => {
      try {
        const { data } = await client.get('/jobs/mine')
        setPaymentHistory(data.jobs.filter((entry) => entry.transaction && entry.status === 'completed'))
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Unable to load your payment history.')
      }
    }

    loadHistory()

    const socket = io({
      auth: { userId: user.id },
    })

    const refreshJob = async (event) => {
      if (event.job?.id !== activeJobId) return

      setJob(event.job)
      try {
        const { data } = await client.get(`/jobs/${event.job.id}/matches`)
        setJob(data.job)
        setMatches(data.matches)
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Unable to refresh the accepted job.')
      }
    }

    socket.on('worker-applied', refreshJob)
    socket.on('job-accepted', refreshJob)

    return () => socket.disconnect()
  }, [user?.id, activeJobId])

  useEffect(() => {
    if (!activeJobId || jobStatus === 'completed') return undefined

    const pollMatches = async () => {
      try {
        const { data } = await client.get(`/jobs/${activeJobId}/matches`)
        setJob(data.job)
        setMatches(data.matches)
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Unable to refresh worker matches.')
      }
    }

    const intervalId = window.setInterval(pollMatches, 3000)
    return () => window.clearInterval(intervalId)
  }, [activeJobId, jobStatus])

  function updateField(event) {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  function toggleSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError('Speech recognition is not supported by this browser.')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => {
      setIsListening(false)
      setError('Voice input was unavailable. You can type your request instead.')
    }
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setForm((currentForm) => ({
        ...currentForm,
        description: `${currentForm.description}${currentForm.description ? ' ' : ''}${transcript}`,
      }))
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const location = await getLocation()
      const request = { ...form, ...location }
      const { data } = await client.post('/jobs', request)
      setJob(data.job)
      setMatches(data.matches)
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to post your service request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function hireWorker(workerId) {
    setHiringWorkerId(workerId)
    setError('')

    try {
      const { data } = await client.post(`/jobs/${activeJobId}/hire`, { worker_id: workerId })
      setJob(data.job)
      setMatches(data.matches)
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to hire this worker.')
    } finally {
      setHiringWorkerId(null)
    }
  }

  const currentStep = Math.max(0, steps.findIndex((step) => step.status === job?.status))

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 transition-colors duration-200 sm:px-6 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <AppHeader onLogout={handleLogout} />

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Service dashboard</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">How can we help, {user?.name || 'there'}?</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Tell us what you need and we will find trusted local workers.</p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors duration-200 dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Request a service</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Choose the kind of help you need and describe the work.</p>

            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Service type</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {serviceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm((currentForm) => ({ ...currentForm, trade: option.value }))}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        form.trade === option.value
                          ? 'border-primary bg-emerald-50 text-primary shadow-sm ring-2 ring-primary/10 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-primary/60 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-400/60'
                      }`}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-xl shadow-sm dark:bg-slate-900">{option.icon}</span>
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold">{option.label}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Describe the work
                <div className="relative mt-2">
                  <textarea
                    className="min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 pr-14 text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                    name="description"
                    value={form.description}
                    onChange={updateField}
                    placeholder="For example: Fix a leaking kitchen tap"
                    required
                  />
                  <button
                    className={`absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-md ring-2 ring-white transition-all duration-200 hover:scale-105 hover:bg-emerald-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/40 dark:ring-slate-800 ${isListening ? 'bg-red-500 hover:bg-red-600' : ''}`}
                    type="button"
                    aria-label={isListening ? 'Stop voice input' : 'Dictate service description'}
                    title={isListening ? 'Stop voice input' : 'Dictate service description'}
                    onClick={toggleSpeechRecognition}
                  >
                    <span aria-hidden="true" className="text-2xl leading-none">{isListening ? '■' : '🎙'}</span>
                  </button>
                </div>
              </label>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <button
                className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Finding workers...' : 'Find a worker'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors duration-200 dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Your request</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{job ? `${job.trade} service request` : 'Your latest request will appear here.'}</p>
              </div>
              {job && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary dark:bg-emerald-950/60 dark:text-emerald-300">{job.status}</span>}
            </div>

            {job ? (
              <>
                <div className="mt-8 flex items-start gap-3">
                  {steps.map((step, index) => (
                    <div className="flex flex-1 items-start" key={step.status}>
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${index <= currentStep ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {index + 1}
                        </div>
                        <span className={`mt-2 text-center text-xs font-semibold ${index <= currentStep ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</span>
                      </div>
                      {index < steps.length - 1 && <div className={`mt-4 h-1 flex-1 ${index < currentStep ? 'bg-primary' : 'bg-slate-100'}`} />}
                    </div>
                  ))}
                </div>

                <div className="mt-10">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Worker matches</h3>
                  {matches.some((match) => match.application_status === 'applied') ? (
                    <div className="mt-3 space-y-3">
                      {matches.filter((match) => match.application_status === 'applied').map((match) => (
                        <WorkerCard
                          key={match.id}
                          name={match.worker_name}
                          trade={match.trade}
                          trustScore={match.trust_score}
                          distance={match.distance_km}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-600 dark:text-slate-300">Applied to help with this request</span>
                            <button
                              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              type="button"
                              disabled={hiringWorkerId === match.worker_id}
                              onClick={() => hireWorker(match.worker_id)}
                            >
                              {hiringWorkerId === match.worker_id ? 'Hiring...' : 'Hire Worker'}
                            </button>
                          </div>
                        </WorkerCard>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">We are waiting for workers to apply.</p>}
                </div>

                {job?.transaction && (
                  <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/80 dark:bg-emerald-950/30">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">Payment split</h3>
                      <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:bg-slate-800/80 dark:text-emerald-300">
                        Total ₹{Number(job.transaction.total_amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-800/80">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Worker</p>
                        <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">₹{Number(job.transaction.worker_amount).toFixed(2)}</p>
                      </div>
                      <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-800/80">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Welfare</p>
                        <p className="mt-2 text-lg font-bold text-amber-700 dark:text-amber-300">₹{Number(job.transaction.welfare_amount).toFixed(2)}</p>
                      </div>
                      <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-800/80">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Platform</p>
                        <p className="mt-2 text-lg font-bold text-sky-700 dark:text-sky-300">₹{Number(job.transaction.platform_amount).toFixed(2)}</p>
                      </div>
                      <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-800/80">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Credits</p>
                        <p className="mt-2 text-lg font-bold text-violet-700 dark:text-violet-300">{Number(job.transaction.credit_points_earned || 0).toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-10 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
                <p>No active request yet.</p>
                <Link className="mt-2 inline-block font-semibold text-primary hover:underline" to="/customer">Start a request</Link>
              </div>
            )}

            <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Recent transactions</h3>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">History</span>
              </div>

              {paymentHistory.length ? (
                <div className="mt-4 space-y-3">
                  {paymentHistory.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{entry.trade}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Completed service</p>
                        </div>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">₹{Number(entry.transaction.total_amount).toFixed(2)}</span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Worker</p>
                          <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">₹{Number(entry.transaction.worker_amount).toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Welfare</p>
                          <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">₹{Number(entry.transaction.welfare_amount).toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Platform</p>
                          <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">₹{Number(entry.transaction.platform_amount).toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Credits</p>
                          <p className="mt-1 font-semibold text-violet-700 dark:text-violet-300">{Number(entry.transaction.credit_points_earned || 0).toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No completed payments yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default CustomerDashboard
