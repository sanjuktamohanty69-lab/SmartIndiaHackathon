import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import WorkerCard from '../components/WorkerCard'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'

const fallbackLocation = { lat: 12.9716, lng: 77.5946 }
const trades = ['plumber', 'electrician', 'carpenter']
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
  const [form, setForm] = useState({ trade: trades[0], description: '' })
  const [job, setJob] = useState(null)
  const [matches, setMatches] = useState([])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const activeJobId = job?.id
  const jobStatus = job?.status

  function handleLogout() {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    if (!user?.id) return undefined

    const socket = io({
      auth: { userId: user.id },
    })

    socket.on('job-accepted', async (event) => {
      if (event.job?.id !== activeJobId) return

      setJob(event.job)
      try {
        const { data } = await client.get(`/jobs/${event.job.id}/matches`)
        setJob(data.job)
        setMatches(data.matches)
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Unable to refresh the accepted job.')
      }
    })

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
    setForm({ ...form, [event.target.name]: event.target.value })
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
      const { data } = await client.post('/jobs', { ...form, ...location })
      setJob(data.job)
      setMatches(data.matches)
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to post your service request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentStep = Math.max(0, steps.findIndex((step) => step.status === job?.status))

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">SahakarWorks</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">How can we help, {user?.name || 'there'}?</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button className="text-sm font-semibold text-slate-600 hover:text-primary" type="button" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="rounded-2xl bg-white p-6 shadow-xl shadow-emerald-950/5 ring-1 ring-slate-200 sm:p-8">
            <h2 className="text-xl font-bold text-slate-900">Request a service</h2>
            <p className="mt-2 text-sm text-slate-600">Tell us what you need and we will find trusted local workers.</p>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <label className="block text-sm font-semibold text-slate-700">
                Service type
                <select
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  name="trade"
                  value={form.trade}
                  onChange={updateField}
                >
                  {trades.map((trade) => <option key={trade} value={trade}>{trade[0].toUpperCase() + trade.slice(1)}</option>)}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Describe the work
                <div className="relative mt-2">
                  <textarea
                    className="min-h-32 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 pr-14 text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                    name="description"
                    value={form.description}
                    onChange={updateField}
                    placeholder="For example: Fix a leaking kitchen tap"
                    required
                  />
                  <button
                    className={`absolute right-3 top-3 rounded-full p-2 text-primary transition hover:bg-emerald-50 ${isListening ? 'bg-emerald-100' : ''}`}
                    type="button"
                    aria-label={isListening ? 'Stop voice input' : 'Dictate service description'}
                    title={isListening ? 'Stop voice input' : 'Dictate service description'}
                    onClick={toggleSpeechRecognition}
                  >
                    <span aria-hidden="true" className="text-lg">{isListening ? '■' : '🎙'}</span>
                  </button>
                </div>
              </label>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <button
                className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Finding workers...' : 'Find a worker'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-xl shadow-emerald-950/5 ring-1 ring-slate-200 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Your request</h2>
                <p className="mt-2 text-sm text-slate-600">{job ? `${job.trade} service request` : 'Your latest request will appear here.'}</p>
              </div>
              {job && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">{job.status}</span>}
            </div>

            {job ? (
              <>
                <div className="mt-8 flex items-start">
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
                  <h3 className="font-bold text-slate-900">Worker matches</h3>
                  {matches.length ? (
                    <div className="mt-3 space-y-3">
                      {matches.map((match) => (
                        <WorkerCard
                          key={match.id}
                          name={match.worker_name}
                          trade={match.trade}
                          trustScore={match.trust_score}
                          distance={match.distance_km}
                        />
                      ))}
                    </div>
                  ) : <p className="mt-3 text-sm text-slate-500">We are looking for available workers.</p>}
                </div>
              </>
            ) : (
              <div className="mt-10 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                <p>No active request yet.</p>
                <Link className="mt-2 inline-block font-semibold text-primary hover:underline" to="/customer">Start a request</Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

export default CustomerDashboard
