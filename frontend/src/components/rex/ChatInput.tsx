import React, { FC, useState } from 'react'

type Props = { onSend: (text: string) => void; disabled?: boolean }
export const ChatInput: FC<Props> = ({ onSend, disabled }) => {
  const [v, setV] = useState('')
  return (
    <div className="sticky bottom-0 border-t border-gray-700 p-4 bg-gray-800 z-10">
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={v}
            onChange={(e)=>setV(e.target.value)}
            onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if(v.trim()) { onSend(v.trim()); setV('') } } }}
            placeholder="Ask REX anything..."
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-colors"
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-400 transition-colors"
            onClick={() => { if (v.trim()) { onSend(v.trim()); setV('') } }}
            disabled={disabled || !v.trim()}
            aria-label="Send"
          >
            <i className="fa-solid fa-paper-plane" />
          </button>
        </div>
        <button className="bg-green-600 hover:bg-green-700 p-3 rounded-lg transition-colors" aria-label="Mic">
          <i className="fa-solid fa-microphone" />
        </button>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <span>Press Enter to send, Shift + Enter for new line</span>
        <span>REX v2.1.0 • Online</span>
      </div>
    </div>
  )
}
export default ChatInput


