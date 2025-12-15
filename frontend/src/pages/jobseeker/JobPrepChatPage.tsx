import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { FaArrowLeft, FaArrowUp, FaCheck, FaWandMagicSparkles, FaPaperclip, FaCircle } from 'react-icons/fa6';
import { supabase } from '../../lib/supabaseClient';
import { chatStream, createConversation, fetchMessages, listConversations, postMessage, type ChatPart } from '../../lib/rexApi';

type Attachment = { name: string; text: string; url?: string };

export default function JobPrepChatPage() {
  const [messages, setMessages] = useState<ChatPart[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string>('Idle · Ready for your next question');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [role, setRole] = useState<string>('');
  const [industry, setIndustry] = useState<string>('');
  const [focus, setFocus] = useState<string>('');
  const [showEditTarget, setShowEditTarget] = useState(false);
  const [tempRole, setTempRole] = useState('');
  const [tempIndustry, setTempIndustry] = useState('');
  const [tempFocus, setTempFocus] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isThinking = streaming || uploading;
  const [outreachStepMarked, setOutreachStepMarked] = useState(false);
  const markTargetStep = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const backend = import.meta.env.VITE_BACKEND_URL || '';
      await fetch(`${backend}/api/jobs/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ step: 'target_role_set', metadata: { source: 'rex_chat_target' } }),
      });
    } catch (e) {
      console.warn('onboarding target_role_set failed (non-blocking)', e);
    }
  }, []);

  const markOutreachStep = useCallback(async () => {
    if (outreachStepMarked) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const backend = import.meta.env.VITE_BACKEND_URL || '';
      await fetch(`${backend}/api/jobs/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ step: 'outreach_angles_created', metadata: { source: 'rex_chat_outreach' } }),
      });
      setOutreachStepMarked(true);
    } catch (e) {
      console.warn('onboarding outreach_angles_created failed (non-blocking)', e);
    }
  }, [outreachStepMarked]);

  const recentActions = useMemo(() => {
    const actions = messages
      .filter((m) => m.role === 'assistant' && m.content && m.content.trim().length > 0)
      .slice(-5)
      .map((m) => {
        const text = m.content.trim();
        const firstSentence = text.split('\n').find((l) => l.trim().length > 0) || text;
        return firstSentence.slice(0, 140);
      })
      .reverse();
    return actions.length ? actions.slice(0, 3) : [];
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  useEffect(() => {
    (async () => {
      try {
        const list = await listConversations();
        if (list.length) {
          setConversationId(list[0].id);
          const msgs = await fetchMessages(list[0].id);
          setMessages(
            msgs.map((m) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: typeof m.content === 'string' ? m.content : m.content?.text || JSON.stringify(m.content),
            }))
          );
        } else {
          const conv = await createConversation('Job Prep Chat');
          setConversationId(conv.id);
        }
      } catch (e) {
        console.error('Load conversation failed', e);
      }
    })();
  }, []);

  const statusDotClass = isThinking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500';
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const prefill = searchParams.get('prefill');
    if (prefill) {
      setInput(prefill);
      setStatusLabel('Ready—attach your resume and hit Send to analyze.');
    }
  }, [searchParams]);

  const dynamicThinking = useMemo(() => {
    if (uploading) return 'Analyzing attached file...';
    if (streaming) {
      return attachments.length ? 'Analyzing your file and crafting a response...' : 'Thinking about your request...';
    }
    return statusLabel;
  }, [streaming, uploading, attachments.length, statusLabel]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rex/uploads`, {
        method: 'POST',
        headers,
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'upload_failed');
      setAttachments((prev) => [...prev, { name: data.name || file.name, text: data.text || '', url: data.url || undefined }]);
      setStatusLabel('File attached · Ready to send');
    } catch (e: any) {
      setStatusLabel(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;
    const attachText = attachments
      .map((a) => `\n\n[Attached: ${a.name}]\n${a.text || '(no text extracted)'}`)
      .join('');
    const userContent = trimmed + attachText;
    const nextMessages = [...messages, { role: 'user' as const, content: userContent }, { role: 'assistant' as const, content: '' }];
    setMessages(nextMessages);
    setInput('');
    setStatusLabel(attachments.length ? 'Analyzing your attachment...' : 'Thinking through your question...');
    setStreaming(true);

    try {
      let convId = conversationId;
      if (!convId) {
        const conv = await createConversation(trimmed.slice(0, 100));
        convId = conv.id;
        setConversationId(conv.id);
      }

      await postMessage(convId!, 'user', { text: userContent, attachments });

      let acc = '';
      for await (const chunk of chatStream(nextMessages)) {
        let text = '';
        try {
          const obj = JSON.parse(chunk);
          text = obj?.reply?.content || obj?.content || '';
        } catch {
          text = chunk;
        }
        if (!text) continue;
        acc += text;
        setMessages((prev) => prev.map((m, idx) => (idx === prev.length - 1 ? { ...m, content: acc } : m)));
      }
      setStatusLabel('Idle · Ready for your next question');
      await postMessage(convId!, 'assistant', { text: acc });
      if (!outreachStepMarked) {
        await markOutreachStep();
      }
    } catch (e: any) {
      setStatusLabel(e?.message || 'Chat failed');
    } finally {
      setStreaming(false);
      setAttachments([]);
    }
  };

  const handleResetConversation = async () => {
    setStreaming(false);
    setUploading(false);
    setAttachments([]);
    setMessages([]);
    setInput('');
    setStatusLabel('Idle · Ready for your next question');
    try {
      const conv = await createConversation('Job Prep Chat');
      setConversationId(conv.id);
    } catch (e) {
      console.error('reset conversation failed', e);
    }
  };

  const handleQuickPrompt = (text: string) => {
    setInput(text);
  };

  return (
    <div className="bg-[#0b1220] text-slate-100 font-sans min-h-[calc(100vh-72px)]">
      <div className="w-full px-4 lg:px-6 py-6 lg:py-8 flex flex-col gap-4 h-[calc(100vh-72px)]">
        {/* Header Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Link to="/prep" className="text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center">
              <FaArrowLeft className="mr-2" />
              Back to Prep
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="px-3 py-1 w-fit rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs sm:text-sm">
                REX · Job Prep Assistant
              </div>
              <div className="space-y-1">
                <h1 className="text-lg sm:text-xl font-semibold text-slate-100 leading-snug">Ask REX anything about your job search</h1>
                <p className="text-sm text-slate-400">
                  Optimize your resume, LinkedIn, outreach messages, and interview prep with an AI coach tuned to your targets.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs sm:text-sm">
              Target: Head of Sales · B2B SaaS
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <span className="hidden sm:inline">Mode:</span>
              <select className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                <option>General</option>
                <option>Resume</option>
                <option>LinkedIn</option>
                <option>Outreach</option>
                <option>Interview</option>
              </select>
            </div>
            <button
              className="text-xs px-3 py-1 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
              onClick={handleResetConversation}
              disabled={streaming || uploading}
              title="Reset conversation and clear messages"
            >
              Reset chat
            </button>
          </div>
        </div>

        {/* Main Layout Grid */}
        <div className="grid flex-1 gap-4 lg:grid-cols-[320px_minmax(0,2.4fr)_340px] w-full">
          {/* Left Column */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 space-y-4 text-xs">
            <div className="space-y-2">
              <h3 className="font-medium text-slate-200">Current context</h3>
              <div className="space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Role:</span>
                  <span className="text-slate-300">{role || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Industry:</span>
                  <span className="text-slate-300">{industry || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Focus:</span>
                  <span className="text-slate-300">{focus || '—'}</span>
                </div>
              </div>
              <button
                className="text-sky-400 hover:text-sky-300 text-xs"
                onClick={() => {
                  setTempRole(role);
                  setTempIndustry(industry);
                  setTempFocus(focus);
                  setShowEditTarget(true);
                }}
              >
                Edit job target
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-slate-200">Attached assets</h3>
              {attachments.length === 0 ? (
                <p className="text-slate-500 text-xs">No assets attached yet.</p>
              ) : (
                <>
                  <div className="space-y-1">
                    {attachments.map((att, idx) => (
                      <div key={`${att.name}-${idx}`} className="flex items-center gap-2 text-slate-300">
                        <FaCheck className="text-emerald-400 text-xs" />
                        <span>{att.name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-500 text-xs">REX will use these when rewriting content.</p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-slate-200">Try asking</h3>
              <div className="space-y-2">
                <button
                  className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-300 text-xs transition-colors"
                  onClick={() => handleQuickPrompt('Rewrite my resume summary for a Head of Sales role.')}
                >
                  Rewrite my resume summary for a Head of Sales role.
                </button>
                <button
                  className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-300 text-xs transition-colors"
                  onClick={() => handleQuickPrompt('Give me 3 stronger bullets for my VP of Sales experience.')}
                >
                  Give me 3 stronger bullets for my VP of Sales experience.
                </button>
                <button
                  className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-300 text-xs transition-colors"
                  onClick={() => handleQuickPrompt("Tighten this LinkedIn 'About' section.")}
                >
                  Tighten this LinkedIn 'About' section.
                </button>
                <button
                  className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-300 text-xs transition-colors"
                  onClick={() => handleQuickPrompt('Draft an outreach email to a VP of Sales recruiter.')}
                >
                  Draft an outreach email to a VP of Sales recruiter.
                </button>
              </div>
            </div>
          </div>

          {/* Center Column - Chat */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 flex flex-col h-[calc(100vh-220px)] min-h-[520px] overflow-hidden relative">
            <div id="messages-area" className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={m.role === 'user' ? 'max-w-[70%]' : 'max-w-[80%]'}>
                    {m.role === 'assistant' ? (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 flex-shrink-0">
                          RX
                        </div>
                        <div className="bg-slate-800 text-slate-100 rounded-3xl rounded-bl-lg px-4 py-3 message-bubble whitespace-pre-line">
                          {m.content}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-sky-500 text-slate-50 rounded-3xl rounded-br-lg px-4 py-3 message-bubble whitespace-pre-line">
                        {m.content}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="max-w-[80%]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 flex-shrink-0">
                        RX
                      </div>
                      <div className="bg-slate-800 text-slate-100 rounded-3xl rounded-bl-lg px-4 py-3 message-bubble">
                        <div className="flex gap-1 mb-2">
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:120ms]" />
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:240ms]" />
                        </div>
                        <p className="text-sm text-slate-400">{dynamicThinking}</p>
                        <div className="mt-2 h-1 w-full rounded-full bg-slate-700">
                          <div className="h-full w-1/2 rounded-full bg-sky-500 transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-2 flex items-end gap-2">
                <button
                  className="text-slate-400 hover:text-slate-200 p-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <FaPaperclip />
                </button>
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onInput={(e) => {
                    const target = e.currentTarget;
                    target.style.height = 'auto';
                    const next = Math.min(target.scrollHeight, 200);
                    target.style.height = `${next}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask REX to improve your resume, LinkedIn, or outreach copy..."
                  className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 resize-none outline-none min-h-[44px] max-h-48 overflow-y-auto"
                />
                <button className="text-slate-400 hover:text-slate-200 p-2">
                  <FaWandMagicSparkles />
                </button>
                <button
                  onClick={handleSend}
                  className="bg-sky-500 hover:bg-sky-400 text-slate-50 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
                  disabled={streaming || uploading}
                >
                  <FaArrowUp />
                </button>
              </div>
              {attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                  {attachments.map((a) => (
                    <span key={a.name} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700">
                      <FaPaperclip className="text-[10px]" />
                      {a.name}
                      <button
                        className="text-slate-400 hover:text-slate-200"
                        onClick={() => setAttachments((prev) => prev.filter((x) => x.name !== a.name))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Status */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 flex flex-col h-full text-xs">
            <div className="space-y-2 mb-4">
              <h3 className="font-medium text-slate-200">REX status</h3>
              <div id="status-indicator" className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${statusDotClass}`} />
                <span className={streaming || uploading ? 'text-emerald-400' : 'text-slate-400'}>{dynamicThinking}</span>
              </div>
            </div>

            {/* thinking/steps UI removed; dynamic indicator handled above */}

            <div className="mt-auto">
              <h4 className="font-medium text-slate-300 mb-2">Recent actions</h4>
              {recentActions.length === 0 ? (
                <p className="text-slate-500 text-xs">No actions yet.</p>
              ) : (
                <ul className="space-y-1 text-slate-400">
                  {recentActions.map((action, idx) => (
                    <li key={`${action}-${idx}`} className="flex items-center gap-2">
                      <FaCircle className={`text-xs ${idx === 0 ? 'text-emerald-400' : 'text-sky-400'}`} />
                      {action}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = '';
        }}
      />

      {showEditTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Edit job target</h3>
              <button className="text-slate-400 hover:text-white" onClick={() => setShowEditTarget(false)}>
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Role</label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/60"
                  value={tempRole}
                  onChange={(e) => setTempRole(e.target.value)}
                  placeholder="e.g., Head of Sales"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Industry</label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/60"
                  value={tempIndustry}
                  onChange={(e) => setTempIndustry(e.target.value)}
                  placeholder="e.g., B2B SaaS"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Focus</label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/60"
                  value={tempFocus}
                  onChange={(e) => setTempFocus(e.target.value)}
                  placeholder="e.g., Leadership · Remote-first"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-750 transition"
                onClick={() => setShowEditTarget(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition"
                onClick={() => {
                  setRole(tempRole.trim());
                  setIndustry(tempIndustry.trim());
                  setFocus(tempFocus.trim());
                  markTargetStep();
                  setShowEditTarget(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
