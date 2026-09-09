import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import CustomerDashboard from './pages/CustomerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Login from './pages/Login'
import Signup from './pages/Signup'
import WorkerDashboard from './pages/WorkerDashboard'

function Placeholder({ title }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
        SahakarWorks
      </p>
      <h1 className="text-4xl font-bold text-slate-900">{title}</h1>
      <p className="mt-3 text-slate-600">This workspace is ready for the {title.toLowerCase()} experience.</p>
      <Link className="mt-8 rounded-md bg-primary px-4 py-2 font-medium text-white" to="/login">
        Go to login
      </Link>
    </main>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/customer" element={<CustomerDashboard />} />
          <Route path="/worker" element={<WorkerDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Placeholder title="Welcome" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
