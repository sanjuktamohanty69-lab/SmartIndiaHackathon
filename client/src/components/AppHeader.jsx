import { Mic, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import logo from '../assets/transparentlogo.png'

export default function AppHeader({ className = '', onLogout }) {
  const { user, logout } = useAuth()
  const displayName = user?.name || 'Dhanvi'
  const avatarUrl = 'https://api.dicebear.com/7.x/adventurer/svg?seed=Dhanvi'

  return (
    <header className={`flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="flex items-center gap-3 bg-transparent p-0 shadow-none">
        <img
          src={logo}
          alt="SahakarWorks logo"
          className="h-10 w-auto bg-transparent object-contain sm:h-12"
        />
        <div className="leading-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">SahakarWorks</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-0 sm:px-4">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search for services, trusted workers, or transactions..."
            className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-12 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
          />
          <button
            type="button"
            aria-label="Voice search"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white shadow-sm transition hover:scale-105 hover:bg-emerald-700"
          >
            <Mic size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <ThemeToggle />
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
          <img src={avatarUrl} alt="User profile" className="h-9 w-9 rounded-full object-cover ring-2 ring-white dark:ring-slate-800" />
          <span className="hidden text-sm font-semibold text-slate-700 dark:text-slate-200 sm:block">{displayName}</span>
        </div>
        <button
          type="button"
          onClick={onLogout || logout}
          className="text-sm font-semibold text-slate-600 transition hover:text-primary dark:text-slate-300 dark:hover:text-emerald-400"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
