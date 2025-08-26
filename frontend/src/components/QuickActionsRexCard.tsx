import React from 'react';

export default function QuickActionsRexCard() {
  const LinkBtn = ({ href, label, emoji }: { href: string; label: string; emoji: string }) => (
    <a href={href} className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-lg">{emoji}</span>
        <span className="font-medium text-gray-900">{label}</span>
      </div>
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
    </a>
  );

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">REX Quick Actions</h2>
        <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Agent Mode</span>
      </div>
      <div className="grid gap-3">
        <LinkBtn href="/agent?tab=campaigns" label="Agent Mode" emoji="🧠" />
        <LinkBtn href="/agent?tab=campaigns" label="Sourcing Campaigns" emoji="📦" />
        <LinkBtn href="/agent?tab=inbox" label="Agent Inbox" emoji="📨" />
      </div>
      <div className="mt-4 text-right">
        <a href="/rex-chat" className="inline-flex items-center text-sm text-purple-600 hover:underline">Chat with REX →</a>
      </div>
    </section>
  );
}


