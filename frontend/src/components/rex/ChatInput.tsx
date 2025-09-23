import React, { FC, useState } from 'react'
import { rexTheme } from '../../theme/rexTheme'

type Props = { onSend: (text: string) => void; disabled?: boolean }
export const ChatInput: FC<Props> = ({ onSend, disabled }) => {
  const [v, setV] = useState('')
  return (
    <div className={`sticky bottom-0 ${rexTheme.bg.input} ${rexTheme.card} ${rexTheme.ring} p-3 mt-4`}>
      <textarea
        value={v}
        onChange={e=>setV(e.target.value)}
        onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if(v.trim()) { onSend(v.trim()); setV('') } } }}
        placeholder="Ask REX anything…"
        rows={1}
        className="w-full resize-none bg-transparent outline-none text-slate-200 placeholder:text-slate-500"
      />
      <div className="flex justify-between mt-2 text-xs text-slate-500">
        <span>Press Enter to send, Shift + Enter for newline</span>
        <button disabled={disabled || !v.trim()} onClick={()=>{ if(v.trim()) { onSend(v.trim()); setV('') } }} className="px-3 py-1.5 rounded bg-[#2a68ff] text-white disabled:opacity-40">Send</button>
      </div>
    </div>
  )
}
export default ChatInput


