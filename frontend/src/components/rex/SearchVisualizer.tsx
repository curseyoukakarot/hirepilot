import React, { FC } from 'react'
import StatusLine from './StatusLine'

type Props = {
  steps: string[]
  done?: boolean
}

export const SearchVisualizer: FC<Props> = ({ steps, done }) => {
  if (!steps.length) return null
  return (
    <div className="space-y-1">
      {steps.map((s, i) => (
        <StatusLine key={i} text={s} done={done && i === steps.length - 1} />
      ))}
    </div>
  )
}

export default SearchVisualizer


