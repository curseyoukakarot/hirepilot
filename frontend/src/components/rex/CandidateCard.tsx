import React, { FC } from 'react'
import { rexTheme } from '../../theme/rexTheme'

type Candidate = {
  name: string
  title: string
  company: string
  experience: string
  salary?: string
  location?: string
  skills: string[]
  matchPct?: number
}

export const CandidateCard: FC<{ c: Candidate }> = ({ c }) => {
  return (
    <div className={`${rexTheme.card} ${rexTheme.bg.panelSoft} ${rexTheme.ring} p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-slate-100">{c.name}</div>
          <div className="text-sm text-slate-400">{c.title} @ {c.company}</div>
        </div>
        {typeof c.matchPct === 'number' && (
          <div className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-medium">{c.matchPct}% Match</div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
        <div className="text-slate-300"><span className="text-slate-400">Experience:</span> {c.experience}</div>
        {c.salary && <div className="text-slate-300"><span className="text-slate-400">Salary:</span> {c.salary}</div>}
        {c.location && <div className="text-slate-300"><span className="text-slate-400">Location:</span> {c.location}</div>}
        <div className="col-span-2 flex flex-wrap gap-2">
          {c.skills.map(s => <span key={s} className="text-xs px-2 py-1 rounded bg-white/5 text-slate-300 border border-white/10">{s}</span>)}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="px-3 py-1.5 text-xs rounded bg-[#2a68ff]/20 text-[#8da2fb] border border-[#8da2fb]/30">LinkedIn</button>
        <button className="px-3 py-1.5 text-xs rounded bg-white/5 text-slate-300 border border-white/10">Contact</button>
      </div>
    </div>
  )
}
export default CandidateCard


