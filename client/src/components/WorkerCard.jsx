import { BadgeCheck, Hammer, Wrench, Zap } from 'lucide-react'

const tradeIcons = {
  plumber: Wrench,
  electrician: Zap,
  carpenter: Hammer,
}

function WorkerCard({ name, trade, trustScore, distance, children }) {
  const TradeIcon = tradeIcons[trade?.toLowerCase()] || Wrench
  const trustClass = trustScore > 90
    ? 'bg-emerald-50 text-emerald-700'
    : trustScore > 80
      ? 'bg-amber-50 text-amber-700'
      : 'bg-slate-100 text-slate-600'

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-primary">
            <TradeIcon size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{name}</p>
            <p className="mt-0.5 capitalize text-sm text-slate-600">{trade}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${trustClass}`}>
          Trust {Math.round(trustScore)}%
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <BadgeCheck size={15} aria-hidden="true" />
          e-Shram Verified
        </span>
        {distance !== undefined && distance !== null && (
          <span>{Number(distance).toFixed(2)} km away</span>
        )}
      </div>

      {children && <div className="mt-4 border-t border-slate-100 pt-4">{children}</div>}
    </article>
  )
}

export default WorkerCard
