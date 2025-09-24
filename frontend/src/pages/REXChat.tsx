import React, { useEffect, useMemo, useRef, useState } from 'react'
import ChatHeader from '../components/rex/ChatHeader'
import ChatMessage from '../components/rex/ChatMessage'
import SearchVisualizer from '../components/rex/SearchVisualizer'
import CandidateCard from '../components/rex/CandidateCard'
import ChatInput from '../components/rex/ChatInput'
import SidebarHistory from '../components/rex/SidebarHistory'
import { usePlan } from '../context/PlanContext'
import { chatStream, ChatPart, listConversations, createConversation, fetchMessages, postMessage, type RexConversation } from '../lib/rexApi'
import { supabase } from '../lib/supabaseClient'
import '../styles/rex.css'

export default function REXChat() {
  const { role, plan } = usePlan()
  const [messages, setMessages] = useState<ChatPart[]>([
    { role: 'assistant', content: 'Hey there! 👋 I\'m REX, your AI recruiting assistant.\n\nI can help you find, analyze, and connect with top talent across:\n\n• LinkedIn profiles & connections\n• Apollo database searches\n• GitHub developer insights\n• Market salary analysis\n\nReady to find some amazing talent? 🚀' }
  ])
  const [status, setStatus] = useState<string | null>(null)
  const [statusSteps, setStatusSteps] = useState<string[]>([])
  const [streaming, setStreaming] = useState(false)
  const [resultCandidates, setResultCandidates] = useState<any[] | null>(null)
  const [conversations, setConversations] = useState<RexConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string>('')
  const scroller = useRef<HTMLDivElement>(null)
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>('')
  const [userName, setUserName] = useState<string>('')

  useEffect(()=>{ scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [messages, status, streaming, resultCandidates])

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const name = `${(user.user_metadata as any)?.first_name || ''} ${(user.user_metadata as any)?.last_name || ''}`.trim() || (user.email || 'You')
          setUserName(name)
          const metaUrl = (user.user_metadata as any)?.avatar_url as string | undefined
          setUserAvatarUrl(metaUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`)
        }
      } catch {}
      const list = await listConversations()
      setConversations(list)
      if (list.length > 0) {
        setActiveConversationId(list[0].id)
        const msgs = await fetchMessages(list[0].id)
        setMessages(msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: typeof m.content === 'string' ? m.content : (m.content?.text ?? JSON.stringify(m.content)) })))
      }
    })()
  }, [])

  useEffect(() => {
    if (!activeConversationId) return
    (async () => {
      const msgs = await fetchMessages(activeConversationId)
      setMessages(msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: typeof m.content === 'string' ? m.content : (m.content?.text ?? JSON.stringify(m.content)) })))
    })()
  }, [activeConversationId])

  async function send(text: string) {
    const next = [...messages, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: '' }]
    setMessages(next)
    setStatus('$ REX Initiating search')
    setStreaming(true)

    // ensure conversation exists
    let convId = activeConversationId
    if (!convId) {
      const conv = await createConversation(text.slice(0, 120))
      convId = conv.id
      setActiveConversationId(conv.id)
      setConversations(await listConversations())
    }

    // persist user message
    await postMessage(convId, 'user', { text })

    let acc = ''
    for await (const chunk of chatStream(next)) {
      // If backend sends JSON objects by chunk, normalize to text
      let text = ''
      try {
        const maybeObj = JSON.parse(chunk)
        // Support shape { reply: { content: string } }
        text = maybeObj?.reply?.content || maybeObj?.content || ''
      } catch {
        text = chunk
      }
      if (!text) continue

      // Detect and render status events only for searches
      if (text.startsWith('__STATUS__:')) {
        const label = text.replace('__STATUS__:', '').trim()
        setStatus(label)
        setStatusSteps(prev => [...prev, label])
        continue
      }

      // Clear status steps when normal assistant text streams
      if (statusSteps.length) setStatusSteps([])
      acc += text
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: acc } : m))
    }
    setStreaming(false)
    setStatus(null)

    // persist assistant text
    await postMessage(convId, 'assistant', { text: acc })
    setConversations(await listConversations())

    // Only show candidates when a real search result is detected
    // Expect backend to emit a special marker like "__CANDIDATES_JSON__:{...}"
    try {
      const marker = '__CANDIDATES_JSON__:'
      const idx = acc.indexOf(marker)
      if (idx >= 0) {
        const jsonStr = acc.slice(idx + marker.length)
        const parsed = JSON.parse(jsonStr)
        if (Array.isArray(parsed?.candidates)) setResultCandidates(parsed.candidates)
      }
    } catch {}
  }

  const historyItems = useMemo(() =>
    conversations.map(c => ({ id: c.id, title: c.title || 'New chat', subtitle: new Date(c.updated_at).toLocaleString(), onClick: () => setActiveConversationId(c.id) })),
    [conversations]
  )

  return (
    <div className="bg-gray-900 text-white h-full min-h-screen">
      <div className="flex h-full min-h-0">
          <SidebarHistory items={historyItems as any} userAvatarUrl={userAvatarUrl} userName={userName} userPlan={(role && role !== 'free') ? role : (plan || 'Free Plan')} onNew={async () => {
            const conv = await createConversation('New chat')
            setActiveConversationId(conv.id)
            setConversations(await listConversations())
            setMessages([])
          }} />
          <div className="flex-1 flex flex-col min-h-0">
            <ChatHeader />
            <div className="flex-1 min-h-0">
              <div className="h-full min-h-0 flex flex-col">
                <div className="flex-1 overflow-y-auto py-6 space-y-6 px-0 md:px-4" ref={scroller}>
              {messages.map((m, idx) => (
                <ChatMessage key={idx} role={m.role} content={m.content} streaming={idx === messages.length - 1 && streaming} userAvatarUrl={userAvatarUrl} />
              ))}
              {Boolean(statusSteps.length) && (
                <SearchVisualizer steps={statusSteps} done={status?.includes('Done')} />
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
      </div>
    </div>
  )
}


