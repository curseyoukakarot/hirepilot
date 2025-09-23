import React, { FC } from 'react'
import { rexTheme, trafficDot } from '../../theme/rexTheme'

export const ChatHeader: FC = () => {
  return (
    <header className={`sticky top-0 z-10 ${rexTheme.bg.terminal} ${rexTheme.ring} ${rexTheme.card} px-4 py-3 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className={`h-3 w-3 rounded-full ${trafficDot.red}`}></span>
          <span className={`h-3 w-3 rounded-full ${trafficDot.yellow}`}></span>
          <span className={`h-3 w-3 rounded-full ${trafficDot.green}`}></span>
        </div>
        <div className="leading-tight">
          <div className={`font-semibold ${rexTheme.text.loud}`}>HirePilot AI Assistant — REX</div>
          <div className={`text-xs ${rexTheme.text.dim}`}>Terminal v2.1.0</div>
        </div>
      </div>
      <div className={`text-xs ${rexTheme.text.dim}`}>REX Online</div>
    </header>
  )
}
export default ChatHeader


