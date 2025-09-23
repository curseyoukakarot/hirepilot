import React, { FC } from 'react'
import { rexTheme } from '../../theme/rexTheme'

type Item = { id: string; title: string; subtitle?: string; onClick: () => void }
export const SidebarHistory: FC<{ items: Item[] }> = ({ items }) => {
  return (
    <aside className={`hidden md:flex md:w-64 flex-col gap-2 p-3 ${rexTheme.bg.panel} ${rexTheme.ring} ${rexTheme.card}`}>
      <div className="text-slate-400 text-xs">Recent Chats</div>
      <div className="flex-1 overflow-auto space-y-2">
        {items.map(i => (
          <button key={i.id} onClick={i.onClick} className="w-full text-left p-3 rounded bg-white/5 hover:bg-white/10 border border-white/10">
            <div className="text-sm text-slate-200 truncate">{i.title}</div>
            {i.subtitle && <div className="text-xs text-slate-500 truncate">{i.subtitle}</div>}
          </button>
        ))}
      </div>
    </aside>
  )
}
export default SidebarHistory


