import React, { useEffect, useMemo, useRef, useState } from 'react'
import ChatHeader from '../components/rex/ChatHeader'
import ChatMessage from '../components/rex/ChatMessage'
import StatusLine from '../components/rex/StatusLine'
import CandidateCard from '../components/rex/CandidateCard'
import ChatInput from '../components/rex/ChatInput'
import SidebarHistory from '../components/rex/SidebarHistory'
import { rexTheme } from '../theme/rexTheme'
import { chatStream, ChatPart } from '../lib/rexApi'
import '../styles/rex.css'

export default function REXChat() {
  const [messages, setMessages] = useState<ChatPart[]>([
    { role: 'assistant', content: 'Hey there! 👋 I\'m REX, your AI recruiting assistant.\n\nI can help you find, analyze, and connect with top talent across:\n\n• LinkedIn profiles & connections\n• Apollo database searches\n• GitHub developer insights\n• Market salary analysis\n\nReady to find some amazing talent? 🚀' }
  ])
  const [status, setStatus] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [resultCandidates, setResultCandidates] = useState<any[] | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(()=>{ scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [messages, status, streaming, resultCandidates])

  async function send(text: string) {
    const next = [...messages, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: '' }]
    setMessages(next)
    setStatus('$ REX Initiating search')
    setStreaming(true)

    let acc = ''
    for await (const chunk of chatStream(next)) {
      if (chunk.includes('Initiating search')) setStatus('$ REX Initiating search')
      else if (chunk.includes('Querying')) setStatus('$ REX Querying LinkedIn + Apollo')
      else if (chunk.includes('Syncing')) setStatus('$ REX Syncing insights')
      else if (chunk.includes('Done')) setStatus('$ REX Done.')
      else {
        acc += chunk
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: acc } : m))
      }
    }
    setStreaming(false)
    setStatus(null)

    setResultCandidates([
      { name: 'Sarah Chen', title: 'Senior React Developer', company: 'Stripe', experience: '6 years', salary: '$180k – $220k', location: 'SF, CA', skills: ['React', 'TypeScript', 'Node.js'], matchPct: 97 },
      { name: 'Marcus Rodriguez', title: 'Lead Frontend Engineer', company: 'Airbnb', experience: '8 years', salary: '$200k – $250k', location: 'SF, CA', skills: ['React', 'GraphQL', 'AWS'], matchPct: 94 },
      { name: 'Emily Park', title: 'Senior Software Engineer', company: 'Meta', experience: '5 years', salary: '$170k – $210k', location: 'SF, CA', skills: ['React', 'Redux', 'Python'], matchPct: 91 },
    ])
  }

  const historyItems = useMemo(() => [
    { id: '1', title: 'React developers in SF', onClick: () => {} },
    { id: '2', title: 'Senior Python engineers', onClick: () => {} },
    { id: '3', title: 'DevOps talent search', onClick: () => {} },
  ], [])

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <div className="mx-auto max-w-7xl">
        <div className="min-h-screen flex">
          <SidebarHistory items={historyItems as any} />
          <div className="flex-1 flex flex-col">
            <ChatHeader />
            <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scroller}>
              {messages.map((m, idx) => (
                <ChatMessage key={idx} role={m.role} content={m.content} streaming={idx === messages.length - 1 && streaming} />
              ))}
              {status && (
                <div className="space-y-1">
                  <StatusLine text="Initiating search" done={status.includes('Done')} />
                  {!status.includes('Done') && <StatusLine text="Querying LinkedIn + Apollo" />}
                  {!status.includes('Done') && <StatusLine text="Syncing insights" />}
                </div>
              )}

              {resultCandidates && (
                <div className="bg-gray-800 rounded-lg p-4 terminal-glow">
                  <div className="text-green-400 font-semibold mb-4">✅ Found 23 senior React developers in San Francisco. Here are the top 3:</div>
                  <div className="space-y-4">
                    {resultCandidates.map((c, i) => <CandidateCard key={i} c={c} />)}
                  </div>
                  <div className="mt-4 p-3 bg-gray-900 rounded border border-gray-600">
                    <p className="text-sm text-gray-300">
                      <i className="fa-solid fa-lightbulb text-yellow-400 mr-2"></i>
                      Want to see more candidates or refine the search? Just let me know your specific requirements!
                    </p>
                  </div>
                </div>
              )}
            </div>
            <ChatInput onSend={send} disabled={streaming} />
          </div>
        </div>
      </div>
    </div>
  )
}


