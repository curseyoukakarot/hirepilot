import React, { useState } from 'react';
import { apiPost } from '../../lib/api';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ProfileForAI = {
  profile_url: string;
  name?: string | null;
  headline?: string | null;
  company_name?: string | null;
};

type GeneratedMsg = {
  profile_url: string;
  generated_message: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  profiles: ProfileForAI[];
  mode: 'connect_note' | 'message';
  /** Called when user clicks "Use These" — returns map of profile_url → message */
  onApply: (messages: Map<string, string>) => void;
};

/* ------------------------------------------------------------------ */
/*  Default templates                                                  */
/* ------------------------------------------------------------------ */

const DEFAULT_CONNECT_NOTE_TEMPLATE = `Write a brief, personalized LinkedIn connection note for this person.

About the sender:
{{user_context}}

Prospect details:
- Name: {{name}}
- Headline: {{headline}}
- Company: {{company}}

Guidelines:
- Be warm and professional
- Reference something specific about them or their role
- Keep it under 280 characters (LinkedIn limit is 300)
- Include a clear reason for connecting
- Don't be salesy or pushy
- Write ONLY the note text, nothing else`;

const DEFAULT_MESSAGE_TEMPLATE = `Write a professional LinkedIn outreach message for this person.

About the sender:
{{user_context}}

Prospect details:
- Name: {{name}}
- Headline: {{headline}}
- Company: {{company}}

Guidelines:
- Be professional and genuine
- Reference their background or role specifically
- Include a clear, soft call-to-action
- Keep it concise (2-4 sentences)
- Don't be overly salesy
- Write ONLY the message text, nothing else`;

/* ------------------------------------------------------------------ */
/*  Available variables reference                                      */
/* ------------------------------------------------------------------ */

const AVAILABLE_VARIABLES = [
  { variable: '{{name}}', description: 'Prospect\'s full name' },
  { variable: '{{headline}}', description: 'LinkedIn headline / job title' },
  { variable: '{{company}}', description: 'Company name' },
  { variable: '{{profile_url}}', description: 'LinkedIn profile URL' },
  { variable: '{{user_context}}', description: 'Your custom context (below)' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AIMessageModal({ open, onClose, profiles, mode, onApply }: Props) {
  const defaultTemplate = mode === 'connect_note' ? DEFAULT_CONNECT_NOTE_TEMPLATE : DEFAULT_MESSAGE_TEMPLATE;
  const maxLen = mode === 'connect_note' ? 300 : 3000;
  const modeLabel = mode === 'connect_note' ? 'Connection Note' : 'Message';

  const [promptTemplate, setPromptTemplate] = useState(defaultTemplate);
  const [userContext, setUserContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedMsg[]>([]);
  const [error, setError] = useState('');
  const [showVars, setShowVars] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

  /* ---- Generate ---- */
  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setGenerated([]);
    try {
      const resp = await apiPost('/api/sniper/actions/generate-messages', {
        profiles: profiles.map((p) => ({
          profile_url: p.profile_url,
          name: p.name || null,
          headline: p.headline || null,
          company_name: p.company_name || null,
        })),
        prompt_template: promptTemplate,
        user_context: userContext,
        mode,
      }) as { ok: boolean; messages: GeneratedMsg[]; count: number };

      if (resp.ok && Array.isArray(resp.messages)) {
        setGenerated(resp.messages);
      } else {
        setError('Unexpected response from AI service.');
      }
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Failed to generate messages. Check your API key configuration.');
    } finally {
      setGenerating(false);
    }
  };

  /* ---- Edit individual message ---- */
  const updateMessage = (idx: number, text: string) => {
    setGenerated((prev) => prev.map((m, i) => (i === idx ? { ...m, generated_message: text } : m)));
  };

  /* ---- Apply ---- */
  const handleApply = () => {
    const map = new Map<string, string>();
    for (const m of generated) {
      if (m.generated_message.trim()) {
        map.set(m.profile_url, m.generated_message.trim());
      }
    }
    onApply(map);
    onClose();
  };

  /* ---- Reset ---- */
  const handleReset = () => {
    setPromptTemplate(defaultTemplate);
    setUserContext('');
    setGenerated([]);
    setError('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm text-lg">
              ✨
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">AI {modeLabel} Generator</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profiles.length} profile{profiles.length !== 1 ? 's' : ''} selected · Customize the prompt, add your context, then generate
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6">

          {/* Step 1: Your Context */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800/50 dark:bg-indigo-950/20">
            <label className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
              Step 1 — Your Context
            </label>
            <p className="mt-1 text-xs text-indigo-600/80 dark:text-indigo-400/80">
              Tell the AI about yourself, your company, and what you're looking for. This is used as <code className="rounded bg-indigo-100 px-1 dark:bg-indigo-900/50">{'{{user_context}}'}</code> in the prompt.
            </p>
            <textarea
              className={cx(inputCls, 'mt-3')}
              rows={3}
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder="E.g., I'm a technical recruiter at Acme Corp. We specialize in placing senior engineers at top startups. I'd love to connect and discuss potential opportunities..."
              maxLength={2000}
            />
            <div className="mt-1 text-right text-[11px] text-slate-400">{userContext.length}/2000</div>
          </div>

          {/* Step 2: Prompt Template */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Step 2 — AI Prompt Template
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowVars(!showVars)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  {showVars ? 'Hide' : 'Show'} variables
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
                >
                  Reset to default
                </button>
              </div>
            </div>

            {/* Available variables */}
            {showVars && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">Available Variables</div>
                <div className="space-y-1">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <div key={v.variable} className="flex items-center gap-3 text-xs">
                      <code className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                        {v.variable}
                      </code>
                      <span className="text-slate-500 dark:text-slate-400">{v.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              className={cx(inputCls, 'mt-3 font-mono text-xs')}
              rows={10}
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              maxLength={5000}
            />
            <div className="mt-1 flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                Tip: Edit this prompt to change tone, style, or focus. The AI will use these instructions for each profile.
              </div>
              <div className="text-[11px] text-slate-400">{promptTemplate.length}/5000</div>
            </div>
          </div>

          {/* Generate button */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {profiles.length} profile{profiles.length !== 1 ? 's' : ''} · Max {maxLen} chars per {mode === 'connect_note' ? 'note' : 'message'}
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !promptTemplate.trim()}
              className={cx(
                'rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-violet-500 hover:to-indigo-500 transition-all',
                (generating || !promptTemplate.trim()) && 'opacity-60 cursor-not-allowed',
              )}
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                `✨ Generate ${modeLabel}s`
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/20 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Generated Messages Preview */}
          {generated.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800/50 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Generated {modeLabel}s ({generated.length})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    Regenerate all
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                {generated.map((m, idx) => {
                  const profile = profiles.find((p) => p.profile_url === m.profile_url);
                  const isEditing = editingIdx === idx;
                  const charCount = m.generated_message.length;
                  const isOverLimit = charCount > maxLen;

                  return (
                    <div
                      key={m.profile_url}
                      className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {/* Profile info */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {profile?.name || 'Unknown'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {profile?.headline || ''}
                            {profile?.company_name ? ` @ ${profile.company_name}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingIdx(isEditing ? null : idx)}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                          >
                            {isEditing ? 'Done' : 'Edit'}
                          </button>
                          <span className={cx(
                            'text-[10px] font-mono',
                            isOverLimit ? 'text-rose-500' : 'text-slate-400',
                          )}>
                            {charCount}/{maxLen}
                          </span>
                        </div>
                      </div>

                      {/* Message text */}
                      {isEditing ? (
                        <textarea
                          className={cx(inputCls, 'text-xs')}
                          rows={mode === 'connect_note' ? 3 : 5}
                          value={m.generated_message}
                          onChange={(e) => updateMessage(idx, e.target.value)}
                          maxLength={maxLen}
                        />
                      ) : (
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300 whitespace-pre-wrap">
                          {m.generated_message || <span className="italic text-slate-400">No message generated</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Apply button */}
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 shadow-lg transition-all"
                >
                  Use These {modeLabel}s
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
