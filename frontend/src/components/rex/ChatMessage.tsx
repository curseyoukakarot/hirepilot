import React, { FC } from 'react'
import { motion } from 'framer-motion'
import { rexTheme } from '../../theme/rexTheme'

type Msg = { role: 'user' | 'assistant'; content: string; streaming?: boolean; userAvatarUrl?: string }
export const ChatMessage: FC<Msg> = ({ role, content, streaming, userAvatarUrl }) => {
  const isUser = role === 'user'
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full message-fade-in">
      {isUser ? (
        <div className="flex items-start space-x-4 justify-end">
          <div className="w-full max-w-[33%]">
            <div className="flex items-center space-x-2 mb-2 justify-end">
              <span className="text-xs text-gray-400">Just now</span>
              <span className="font-medium">You</span>
            </div>
            <div className="bg-blue-600 rounded-lg p-4 text-white">
              <p className="whitespace-pre-wrap">{content}</p>
            </div>
          </div>
          <img src={userAvatarUrl || 'https://ui-avatars.com/api/?name=You&background=random'} className="w-8 h-8 rounded-full flex-shrink-0" />
        </div>
      ) : (
        <div className="flex items-start space-x-4">
          <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-robot text-sm"></i>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="font-mono text-green-400 font-semibold">$ REX</span>
              <span className="text-xs text-gray-400">Response</span>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 terminal-glow w-full">
              <p className={`${rexTheme.text.base} whitespace-pre-wrap`}>{content}{streaming && <span className="caret-blink">▋</span>}</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
export default ChatMessage


