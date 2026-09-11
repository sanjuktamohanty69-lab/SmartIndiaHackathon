import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import DocumentUpload from '../components/DocumentUpload'
import logo from '../assets/transparentlogo.png'

const bengaluruLocation = { lat: 12.9716, lng: 77.5946 }

function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    role: 'customer',
    trade: 'plumber',
  })
  const [documents, setDocuments] = useState([])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await client.post('/auth/signup', {
        ...form,
        ...(form.role === 'worker' ? bengaluruLocation : {}),
      })
      navigate('/login')
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to create your account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 transition-colors duration-200 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-emerald-950/5 ring-1 ring-slate-200 transition-colors duration-200 dark:bg-slate-900 dark:ring-slate-700">
        <div className="mb-8 flex flex-col items-center justify-center bg-transparent p-0 text-center">
          <img src={logo} alt="SahakarWorks logo" className="h-10 w-auto bg-transparent object-contain sm:h-12" />
          <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-100">Create your account</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Join a trusted local services network.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Full name
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              name="name"
              value={form.name}
              onChange={updateField}
              placeholder="Enter your name"
              required
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Phone number
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={updateField}
              placeholder="Enter your phone number"
              required
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Password
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              placeholder="Create a password"
              required
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            I am a
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              name="role"
              value={form.role}
              onChange={updateField}
            >
              <option value="customer">Customer</option>
              <option value="worker">Worker</option>
            </select>
          </label>

          {form.role === 'worker' && (
            <>
              <label className="block text-sm font-semibold text-slate-700">
                Trade
                <select
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  name="trade"
                  value={form.trade}
                  onChange={updateField}
                >
                  <option value="plumber">Plumber</option>
                  <option value="electrician">Electrician</option>
                  <option value="carpenter">Carpenter</option>
                  <option value="househelp">Househelp</option>
                </select>
              </label>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Verification documents</p>
                <DocumentUpload
                  label="Upload your work documents"
                  helperText="Add ID, skills proof, and work profile documents"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  maxFiles={3}
                  onFilesChange={setDocuments}
                />
                {documents.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {documents.length} document(s) selected for verification.
                  </p>
                )}
              </div>
            </>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already registered?{' '}
          <Link className="font-semibold text-primary hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  )
}

export default Signup
