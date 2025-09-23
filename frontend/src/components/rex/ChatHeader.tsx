import React, { FC } from 'react'

export const ChatHeader: FC = () => {
  return (
    <header className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div>
            <h1 className="text-lg font-semibold">HirePilot AI Assistant – REX</h1>
            <p className="text-sm text-gray-400">Terminal v2.1.0</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors" aria-label="Settings">
            <i className="fa-solid fa-gear text-gray-400"></i>
          </button>
          <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors" aria-label="Menu">
            <i className="fa-solid fa-ellipsis-vertical text-gray-400"></i>
          </button>
        </div>
      </div>
    </header>
  )
}
export default ChatHeader


