import React, { FC } from 'react'
import { rexTheme } from '../../theme/rexTheme'

type Props = { text: string; done?: boolean }
export const StatusLine: FC<Props> = ({ text, done }) => {
  return (
    <div className={`font-mono text-sm ${done ? 'text-emerald-400' : rexTheme.text.dim}`}>
      <span className={rexTheme.text.green}>$ REX</span> {text}{!done && <span className="animate-pulse">…</span>} {done && ' ✔'}
    </div>
  )
}
export default StatusLine


