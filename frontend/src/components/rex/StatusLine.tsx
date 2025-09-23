import React, { FC } from 'react'

type Props = { text: string; done?: boolean }
export const StatusLine: FC<Props> = ({ text, done }) => {
  return (
    <div className={`font-mono text-sm ${done ? 'text-emerald-400' : 'text-gray-300'}`}>
      <span className="text-green-400 font-mono">$ REX</span> {text}
      {!done && (
        <span className="inline-flex ml-2">
          <span className="dot-pulse">.</span>
          <span className="dot-pulse" style={{ animationDelay: '0.2s' }}>.</span>
          <span className="dot-pulse" style={{ animationDelay: '0.4s' }}>.</span>
        </span>
      )}
      {done && <i className="fa-solid fa-check text-green-400 ml-2" />}
    </div>
  )}
export default StatusLine


