/**
 * Schedule UI for installed Skills.
 *
 * Drops on the Team page. Shows every installed Skill on every hired
 * specialist where skills_catalog.schedule_capable = true (only those
 * make sense to schedule — drafting / sending Skills don't).
 *
 * Each row has a preset dropdown (Off, hourly, daily 9am, weekdays,
 * weekly) plus a Custom cron input. Saves via PATCH /api/v2/agents/:id/
 * skills/:skillId { schedule_cron }.
 */

import React, { useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import type { Agent, InstalledSkill } from '../types';

const PRESETS: Array<{ label: string; value: string | null; description: string }> = [
  { label: 'Off',                 value: null,           description: 'Run only when invoked manually or by a goal' },
  { label: 'Every hour',          value: '0 * * * *',     description: 'Top of every hour' },
  { label: 'Every 6 hours',       value: '0 */6 * * *',   description: '6am, noon, 6pm, midnight UTC' },
  { label: 'Daily · 9am',         value: '0 9 * * *',     description: '9am UTC every day' },
  { label: 'Weekdays · 9am',      value: '0 9 * * 1-5',   description: 'Mon-Fri 9am UTC' },
  { label: 'Weekly · Mon 9am',    value: '0 9 * * 1',     description: 'Monday 9am UTC' },
];

function presetForCron(cron: string | null | undefined): string | null {
  if (!cron) return null;
  const found = PRESETS.find((p) => p.value === cron);
  return found ? cron : '__custom';
}

export function ScheduledSkillsPanel({ agents }: { agents: Agent[] }) {
  // Flatten all schedule_capable installed skills with their owning agent.
  const rows: Array<{ agent: Agent; skill: InstalledSkill }> = [];
  for (const a of agents) {
    for (const s of a.skills || []) {
      if (s.skills_catalog?.schedule_capable) rows.push({ agent: a, skill: s });
    }
  }

  if (rows.length === 0) return null;

  return (
    <section>
      <div className="float-in flex items-end justify-between mb-4">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight">Schedule Skills</h2>
          <p className="text-text-muted text-[12.5px] mt-0.5">
            Skills that can run on a recurring schedule. Set a cadence below — REX picks them up automatically.
          </p>
        </div>
        <span className="text-[11.5px] text-text-muted">{rows.length} schedulable Skill{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
        {rows.map(({ agent, skill }) => (
          <ScheduledSkillRow key={`${agent.id}:${skill.skill_id}`} agent={agent} skill={skill} />
        ))}
      </div>

      <p className="text-center text-[11px] text-text-muted mt-3 italic">
        Cron times are in UTC. Custom expressions accept the standard 5-field cron format.
      </p>
    </section>
  );
}

function ScheduledSkillRow({ agent, skill }: { agent: Agent; skill: InstalledSkill }) {
  const { updateSkill } = useAgents();
  const initialPreset = presetForCron(skill.schedule_cron);
  const [preset, setPreset] = useState<string | null>(initialPreset);
  const [customCron, setCustomCron] = useState<string>(
    initialPreset === '__custom' ? (skill.schedule_cron || '') : '',
  );
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const apply = (nextPreset: string | null, nextCustom?: string) => {
    setPreset(nextPreset);
    let cron: string | null;
    if (nextPreset === null) cron = null;
    else if (nextPreset === '__custom') cron = (nextCustom ?? customCron).trim() || null;
    else cron = nextPreset;

    updateSkill.mutate({
      agentId: agent.id,
      skillId: skill.skill_id,
      schedule_cron: cron || undefined,
      // Pass empty string instead of undefined to clear when going Off.
      ...(cron === null ? { schedule_cron: '' as any } : {}),
    } as any, {
      onSuccess: () => {
        setSavedNote(cron ? `Saved · runs ${cron}` : 'Saved · scheduled run disabled');
        setTimeout(() => setSavedNote(null), 2500);
      },
    });
  };

  const skillName = skill.skills_catalog?.name || skill.skill_id;
  const lastRun = skill.last_run_at ? new Date(skill.last_run_at).toLocaleString() : '—';

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] shrink-0"
        style={{ background: 'linear-gradient(135deg,#6B46C1,#0C5CF4)' }}>
        <i className="fa-solid fa-clock-rotate-left" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[13px]">{skillName}</span>
          <span className="text-[10.5px] text-text-muted">·</span>
          <span className="text-[10.5px] text-text-muted">{agent.role}</span>
          {savedNote && (
            <span className="text-[10.5px] text-success font-semibold ml-1">{savedNote}</span>
          )}
        </div>
        <div className="text-[10.5px] text-text-muted">Last run: {lastRun}</div>
      </div>

      <select
        value={preset === null ? 'null' : preset}
        onChange={(e) => apply(e.target.value === 'null' ? null : e.target.value, customCron)}
        className="text-[12px] px-2.5 py-1.5 rounded-md border border-gray-200 bg-white"
        disabled={updateSkill.isPending}
      >
        {PRESETS.map((p) => (
          <option key={p.label} value={p.value === null ? 'null' : p.value}>{p.label}</option>
        ))}
        <option value="__custom">Custom…</option>
      </select>

      {preset === '__custom' && (
        <input
          type="text"
          value={customCron}
          onChange={(e) => setCustomCron(e.target.value)}
          onBlur={() => apply('__custom', customCron)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="0 9 * * 1-5"
          className="text-[12px] px-2.5 py-1.5 rounded-md border border-gray-200 bg-white font-mono w-36"
          disabled={updateSkill.isPending}
        />
      )}
    </div>
  );
}
