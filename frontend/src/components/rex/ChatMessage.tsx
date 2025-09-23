import React, { FC } from 'react'
import { motion } from 'framer-motion'
import { rexTheme } from '../../theme/rexTheme'

type Msg = { role: 'user' | 'assistant'; content: string; streaming?: boolean }
export const ChatMessage: FC<Msg> = ({ role, content, streaming }) => {
  const isUser = role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full`}
    >
      <div className={`max-w-3xl ${isUser ? 'ml-auto' : ''}`}>
        <div className={`${rexTheme.card} ${rexTheme.bg.panel} px-4 py-3 ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'} ${rexTheme.ring}`}>
          <div className={`${isUser ? 'text-sky-200' : rexTheme.text.base} whitespace-pre-wrap`}>{content}{streaming && <span className="caret-blink">▋</span>}</div>
        </div>
      </div>
    </motion.div>
  )
}
export default ChatMessage


