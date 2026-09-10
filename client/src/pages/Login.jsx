import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ phone: '', password: '' })
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
      const data = await login(form)
      navigate(`/${data.user.role}`)
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to log in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 transition-colors duration-200 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-emerald-950/5 ring-1 ring-slate-200 transition-colors duration-200 dark:bg-slate-900 dark:ring-slate-700">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">SahakarWorks</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-100">Welcome back</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Sign in to continue to your workspace.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
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
              placeholder="Enter your password"
              required
            />
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
          New to SahakarWorks?{' '}
          <Link className="font-semibold text-primary hover:underline" to="/signup">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  )
}

export default Login
