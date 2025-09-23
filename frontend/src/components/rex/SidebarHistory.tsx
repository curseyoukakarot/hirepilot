import React, { FC } from 'react'

type Item = { id: string; title: string; subtitle?: string; onClick: () => void }
export const SidebarHistory: FC<{ items: Item[]; onNew?: () => void }> = ({ items, onNew }) => {
  return (
    <aside className="hidden md:flex md:w-64 bg-gray-800 border-r border-gray-700 flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
            <i className="fa-solid fa-robot text-sm"></i>
          </div>
          <div>
            <h2 className="text-sm font-semibold">HirePilot AI</h2>
            <p className="text-xs text-gray-400">REX Assistant</p>
          </div>
        </div>
        <button onClick={onNew} className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition-colors mt-4">
          <div className="flex items-center space-x-3">
            <i className="fa-solid fa-plus text-green-400"></i>
            <span className="text-sm">New Chat</span>
          </div>
        </button>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">Recent Chats</div>
        <div className="space-y-2">
          {items.map(i => (
            <button key={i.id} onClick={i.onClick} className="w-full bg-gray-700/50 rounded-lg p-3 cursor-pointer hover:bg-gray-700 transition-colors text-left">
              <p className="text-sm truncate">{i.title}</p>
              {i.subtitle && <p className="text-xs text-gray-400">{i.subtitle}</p>}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center space-x-3">
          <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" className="w-8 h-8 rounded-full" />
          <div>
            <p className="text-sm font-medium">Brandon</p>
            <p className="text-xs text-gray-400">Free Plan</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
export default SidebarHistory


