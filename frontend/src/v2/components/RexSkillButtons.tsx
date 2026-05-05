/**
 * Reusable group of "Run a Skill" buttons backed by useAgents().invokeSkill.
 *
 * Drop into any v2 surface (Leads drawer, Pipelines candidate card, Inbox
 * thread, etc.) by passing the relevant skills array. The component manages:
 *
 *   - Pending / executed / held / error states
 *   - Inline result pill with deep-link to /v2/decisions when held
 *   - Disabled state across all buttons while one is in flight
 *
 * Filter what to show based on the workspace's hired specialists in the
 * caller — this component just renders whatever it's given.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgents } from '../hooks/useAgents';

export interface SkillButtonSpec {
  agentId: string;
  skillId: string;
  label: string;
  icon: string;          // FontAwesome class without the leading 'fa-'
  cost?: string;         // Optional inline cost label, e.g. "1 cr (house)" or "free"
  input: any;            // Skill-specific input payload
}

export interface RexSkillButtonsProps {
  skills: SkillButtonSpec[];
  /** Title of the panel ("REX Skills" by default). */
  title?: string;
  /** Sub-label on the right of the title. */
  subtitle?: string;
  /** Render in compact (chip-only) mode without the wrapper card. */
  compact?: boolean;
  /** Callback fired after a skill executes successfully (for refetching adjacent data). */
  onResult?: (input: { skillId: string; result: any }) => void;
}

type ResultState = { skill: string; status: 'held' | 'ok' | 'error'; message: string };

export function RexSkillButtons({
  skills,
  title = 'REX Skills',
  subtitle = 'your team can run these',
  compact = false,
  onResult,
}: RexSkillButtonsProps) {
  const { invokeSkill } = useAgents();
  const [result, setResult] = useState<ResultState | null>(null);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  if (!skills.length) return null;

  const run = async (b: SkillButtonSpec) => {
    setActiveSkill(b.skillId);
    setResult(null);
    try {
      const res: any = await invokeSkill.mutateAsync({ agentId: b.agentId, skillId: b.skillId, input: b.input });
      onResult?.({ skillId: b.skillId, result: res });
      if (res?.held) {
        setResult({ skill: b.label, status: 'held', message: res.message || 'Held for review on the Decisions page.' });
      } else if (res?.ok === false || res?.error) {
        setResult({ skill: b.label, status: 'error', message: res.message || res.error || 'Failed.' });
      } else {
        const credits = res?.data?._credit_meta?.credits_charged;
        setResult({
          skill: b.label,
          status: 'ok',
          message: credits ? `Done · ${credits} credit${credits === 1 ? '' : 's'} charged.` : 'Done.',
        });
      }
    } catch (e: any) {
      setResult({ skill: b.label, status: 'error', message: e?.message || 'Failed.' });
    } finally {
      setActiveSkill(null);
    }
  };

  const buttonsRow = (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((b) => {
        const pending = activeSkill === b.skillId;
        return (
          <button
            key={b.skillId}
            onClick={() => run(b)}
            disabled={pending || invokeSkill.isPending}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] font-semibold border border-gray-200 hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
          >
            <i className={`fa-solid ${pending ? 'fa-spinner fa-spin' : `fa-${b.icon}`} text-[10px]`} style={{ color: '#6B46C1' }} />
            {b.label}
            {b.cost && <span className="text-text-muted text-[10px] font-normal">· {b.cost}</span>}
          </button>
        );
      })}
    </div>
  );

  const resultPill = result && (
    <div
      className={`mt-2.5 px-2.5 py-2 rounded-md text-[11.5px] flex items-start gap-2 ${
        result.status === 'held' ? 'bg-warn/10 text-warn border border-warn/25'
          : result.status === 'error' ? 'bg-danger/10 text-danger border border-danger/25'
          : 'bg-success/10 text-success border border-success/25'
      }`}
    >
      <i className={`fa-solid ${
        result.status === 'held' ? 'fa-circle-question' :
        result.status === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'
      } text-[10px] mt-0.5`} />
      <div>
        <span className="font-semibold">{result.skill}</span> — {result.message}
        {result.status === 'held' && (
          <Link to="/v2/decisions" className="underline ml-1">Open Decisions →</Link>
        )}
      </div>
    </div>
  );

  if (compact) {
    return (
      <>
        {buttonsRow}
        {resultPill}
      </>
    );
  }

  return (
    <div className="p-3.5 rounded-xl bg-white" style={{ border: '1px solid #ECECEC' }}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 rounded-md grad-icon flex items-center justify-center text-white shrink-0">
          <i className="fa-solid fa-bolt text-[10px]" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider grad-text">{title}</span>
        {subtitle && <span className="text-[10.5px] text-text-muted ml-auto">{subtitle}</span>}
      </div>
      {buttonsRow}
      {resultPill}
    </div>
  );
}

/**
 * Inline empty state when the workspace hasn't hired the specialists needed
 * for a given surface. Drops a hire CTA pointing at /v2/hire.
 */
export function RexSkillsHireCTA({ message }: { message: string }) {
  return (
    <div className="p-3.5 rounded-xl border border-dashed border-primary/25 bg-white/40">
      <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1.5">
        <i className="fa-solid fa-wand-magic-sparkles text-[10px] mr-1" />Skills
      </div>
      <p className="text-[12.5px] text-text-secondary mb-2">{message}</p>
      <Link to="/v2/hire" className="text-[11.5px] text-primary font-semibold hover:underline">
        Browse the catalog →
      </Link>
    </div>
  );
}
