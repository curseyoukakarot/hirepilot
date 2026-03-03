import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../../lib/api';

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type ToastT = { show: boolean; message: string; type: 'success' | 'error' | 'info' };

function Toast({ show, message, type }: ToastT) {
  if (!show) return null;
  return (
    <div className="fixed top-5 right-5 z-[99999]">
      <div
        className={cx(
          'rounded-xl border px-4 py-3 shadow-xl backdrop-blur',
          'bg-white/90 border-slate-200 text-slate-900 dark:bg-slate-950/90 dark:border-slate-800 dark:text-slate-100',
          type === 'success' && 'border-emerald-300 dark:border-emerald-700/60',
          type === 'error' && 'border-rose-300 dark:border-rose-700/60',
          type === 'info' && 'border-sky-300 dark:border-sky-700/60',
        )}
      >
        <div className="text-sm font-semibold">{message}</div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused' | 'archived';
  stop_on_reply: boolean;
  lead_source_json: any;
  settings_json: any;
  stats_json: any;
  created_at: string;
  updated_at: string;
};

type CampaignStep = {
  id?: string;
  campaign_id?: string;
  step_order: number;
  action_type: 'wait' | 'connect' | 'message' | 'profile_visit' | 'like_post';
  delay_days: number;
  delay_hours: number;
  config_json: any;
};

type Enrollment = {
  id: string;
  campaign_id: string;
  profile_url: string;
  profile_name: string | null;
  status: 'active' | 'completed' | 'paused' | 'replied' | 'bounced' | 'error';
  current_step_order: number;
  next_step_at: string | null;
  last_action_at: string | null;
  created_at: string;
};

type View = 'list' | 'create' | 'detail';

/* ================================================================== */
/*  Step action metadata                                               */
/* ================================================================== */

const ACTION_META: Record<string, { emoji: string; label: string; color: string; hasConfig: boolean }> = {
  wait: { emoji: '\u23F3', label: 'Wait', color: 'bg-slate-500', hasConfig: false },
  connect: { emoji: '\uD83E\uDD1D', label: 'Connect', color: 'bg-sky-600', hasConfig: true },
  message: { emoji: '\uD83D\uDCAC', label: 'Message', color: 'bg-violet-600', hasConfig: true },
  profile_visit: { emoji: '\uD83D\uDC41\uFE0F', label: 'Profile Visit', color: 'bg-emerald-600', hasConfig: false },
  like_post: { emoji: '\u2764\uFE0F', label: 'Like Post', color: 'bg-rose-500', hasConfig: false },
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  archived: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  replied: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  bounced: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  error: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

/* ================================================================== */
/*  Props                                                              */
/* ================================================================== */

type Props = {
  onClose: () => void;
};

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

export default function CampaignBuilder({ onClose }: Props) {
  const [view, setView] = useState<View>('list');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastT>({ show: false, message: '', type: 'info' });

  // Create/edit state
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStopOnReply, setFormStopOnReply] = useState(true);
  const [formSteps, setFormSteps] = useState<CampaignStep[]>([]);

  // Detail state
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [detailSteps, setDetailSteps] = useState<CampaignStep[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollTotal, setEnrollTotal] = useState(0);
  const [enrollLoading, setEnrollLoading] = useState(false);

  // Enroll modal
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollInput, setEnrollInput] = useState('');

  const flash = useCallback((message: string, type: ToastT['type'] = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }, []);

  /* ─── Fetch campaigns ─────────────────────────────────────────── */

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/sniper/campaigns');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (e: any) {
      flash(e?.message || 'Failed to load campaigns', 'error');
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  /* ─── Open campaign detail ─────────────────────────────────────── */

  const openDetail = useCallback(async (campaign: Campaign) => {
    try {
      const data = await apiGet(`/api/sniper/campaigns/${campaign.id}`);
      setDetailCampaign(data.campaign || campaign);
      setDetailSteps(data.steps || []);
      const enrollData = await apiGet(`/api/sniper/campaigns/${campaign.id}/enrollments?limit=100`);
      setEnrollments(enrollData.enrollments || []);
      setEnrollTotal(enrollData.total || 0);
      setView('detail');
    } catch (e: any) {
      flash(e?.message || 'Failed to load campaign', 'error');
    }
  }, [flash]);

  /* ─── Open create/edit form ────────────────────────────────────── */

  const openCreate = useCallback(() => {
    setEditCampaign(null);
    setFormName('');
    setFormDesc('');
    setFormStopOnReply(true);
    setFormSteps([
      { step_order: 1, action_type: 'connect', delay_days: 0, delay_hours: 0, config_json: { note: '' } },
      { step_order: 2, action_type: 'wait', delay_days: 2, delay_hours: 0, config_json: {} },
      { step_order: 3, action_type: 'message', delay_days: 0, delay_hours: 0, config_json: { body: '' } },
    ]);
    setView('create');
  }, []);

  const openEdit = useCallback(async (campaign: Campaign) => {
    try {
      const data = await apiGet(`/api/sniper/campaigns/${campaign.id}`);
      setEditCampaign(data.campaign || campaign);
      setFormName((data.campaign || campaign).name);
      setFormDesc((data.campaign || campaign).description || '');
      setFormStopOnReply((data.campaign || campaign).stop_on_reply ?? true);
      setFormSteps((data.steps || []).map((s: any) => ({
        step_order: s.step_order,
        action_type: s.action_type,
        delay_days: s.delay_days,
        delay_hours: s.delay_hours,
        config_json: s.config_json || {},
      })));
      setView('create');
    } catch (e: any) {
      flash(e?.message || 'Failed to load campaign', 'error');
    }
  }, [flash]);

  /* ─── Save campaign ────────────────────────────────────────────── */

  const saveCampaign = useCallback(async () => {
    if (!formName.trim()) { flash('Campaign name is required', 'error'); return; }
    if (!formSteps.length) { flash('Add at least one step', 'error'); return; }

    try {
      if (editCampaign) {
        // Update existing
        await apiPatch(`/api/sniper/campaigns/${editCampaign.id}`, {
          name: formName,
          description: formDesc || null,
          stop_on_reply: formStopOnReply,
        });
        await apiPut(`/api/sniper/campaigns/${editCampaign.id}/steps`, { steps: formSteps });
        flash('Campaign updated!', 'success');
      } else {
        // Create new with inline steps
        await apiPost('/api/sniper/campaigns', {
          name: formName,
          description: formDesc || null,
          stop_on_reply: formStopOnReply,
          steps: formSteps,
        });
        flash('Campaign created!', 'success');
      }
      await fetchCampaigns();
      setView('list');
    } catch (e: any) {
      flash(e?.message || 'Failed to save campaign', 'error');
    }
  }, [editCampaign, formName, formDesc, formStopOnReply, formSteps, fetchCampaigns, flash]);

  /* ─── Toggle campaign status ───────────────────────────────────── */

  const toggleStatus = useCallback(async (campaign: Campaign, newStatus: string) => {
    try {
      await apiPatch(`/api/sniper/campaigns/${campaign.id}`, { status: newStatus });
      flash(`Campaign ${newStatus}!`, 'success');
      await fetchCampaigns();
      if (detailCampaign?.id === campaign.id) {
        setDetailCampaign((c) => c ? { ...c, status: newStatus as any } : c);
      }
    } catch (e: any) {
      flash(e?.message || 'Failed to update', 'error');
    }
  }, [fetchCampaigns, flash, detailCampaign]);

  /* ─── Delete campaign ──────────────────────────────────────────── */

  const deleteCampaign = useCallback(async (campaign: Campaign) => {
    if (!window.confirm(`Delete "${campaign.name}"? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/sniper/campaigns/${campaign.id}`);
      flash('Campaign deleted', 'success');
      await fetchCampaigns();
      setView('list');
    } catch (e: any) {
      flash(e?.message || 'Failed to delete', 'error');
    }
  }, [fetchCampaigns, flash]);

  /* ─── Enroll profiles ──────────────────────────────────────────── */

  const enrollProfiles = useCallback(async () => {
    if (!detailCampaign || !enrollInput.trim()) return;
    const urls = enrollInput.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!urls.length) { flash('Paste LinkedIn profile URLs (one per line)', 'error'); return; }

    try {
      setEnrollLoading(true);
      const profiles = urls.map((url) => ({ profile_url: url }));
      const res = await apiPost(`/api/sniper/campaigns/${detailCampaign.id}/enroll`, { profiles });
      flash(`Enrolled ${res.enrolled || urls.length} profiles!`, 'success');
      setShowEnrollModal(false);
      setEnrollInput('');
      // Refresh enrollments
      const enrollData = await apiGet(`/api/sniper/campaigns/${detailCampaign.id}/enrollments?limit=100`);
      setEnrollments(enrollData.enrollments || []);
      setEnrollTotal(enrollData.total || 0);
    } catch (e: any) {
      flash(e?.message || 'Failed to enroll', 'error');
    } finally {
      setEnrollLoading(false);
    }
  }, [detailCampaign, enrollInput, flash]);

  /* ─── Toggle enrollment status ─────────────────────────────────── */

  const toggleEnrollment = useCallback(async (enrollment: Enrollment) => {
    if (!detailCampaign) return;
    const newStatus = enrollment.status === 'paused' ? 'active' : 'paused';
    try {
      await apiPatch(
        `/api/sniper/campaigns/${detailCampaign.id}/enrollments/${enrollment.id}`,
        { status: newStatus }
      );
      setEnrollments((prev) => prev.map((e) =>
        e.id === enrollment.id ? { ...e, status: newStatus } : e
      ));
    } catch (e: any) {
      flash(e?.message || 'Failed to update', 'error');
    }
  }, [detailCampaign, flash]);

  /* ─── Step builder helpers ─────────────────────────────────────── */

  const addStep = useCallback((action: CampaignStep['action_type']) => {
    setFormSteps((prev) => [
      ...prev,
      {
        step_order: prev.length + 1,
        action_type: action,
        delay_days: action === 'wait' ? 1 : 0,
        delay_hours: 0,
        config_json: action === 'connect' ? { note: '' } : action === 'message' ? { body: '' } : {},
      },
    ]);
  }, []);

  const removeStep = useCallback((idx: number) => {
    setFormSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i + 1 })));
  }, []);

  const updateStep = useCallback((idx: number, patch: Partial<CampaignStep>) => {
    setFormSteps((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }, []);

  const moveStep = useCallback((idx: number, dir: 'up' | 'down') => {
    setFormSteps((prev) => {
      const arr = [...prev];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= arr.length) return prev;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return arr.map((s, i) => ({ ...s, step_order: i + 1 }));
    });
  }, []);

  /* ================================================================ */
  /*  Render helpers                                                    */
  /* ================================================================ */

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return iso; }
  };

  const campaignStats = (c: Campaign) => {
    const s = c.stats_json || {};
    return {
      active: s.active || 0,
      completed: s.completed || 0,
      replied: s.replied || 0,
      total: s.total || 0,
    };
  };

  /* ================================================================ */
  /*  Render: Campaign List                                            */
  /* ================================================================ */

  function renderList() {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Campaign Sequences</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Create multi-step LinkedIn outreach campaigns with automated follow-ups.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
          >
            <span className="text-lg">+</span> New Campaign
          </button>
        </div>

        {/* Campaign cards */}
        {loading ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center dark:border-slate-700 dark:bg-slate-950">
            <div className="text-4xl">🔗</div>
            <h3 className="mt-4 text-lg font-bold">No campaigns yet</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Create your first multi-step outreach sequence to get started.
            </p>
            <button
              onClick={openCreate}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              <span className="text-lg">+</span> Create Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const stats = campaignStats(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openDetail(c)}
                  className="group w-full text-left rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  <div className="flex items-start justify-between">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm">
                      🔗
                    </div>
                    <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_COLORS[c.status] || STATUS_COLORS.draft)}>
                      {c.status}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-bold truncate">{c.name}</h3>
                  {c.description && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{c.description}</p>
                  )}
                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>{stats.total} enrolled</span>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <span>{stats.completed} done</span>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <span>{stats.replied} replied</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    Created {formatDate(c.created_at)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ================================================================ */
  /*  Render: Create / Edit Form                                       */
  /* ================================================================ */

  function renderCreateEdit() {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView(editCampaign ? 'detail' : 'list')}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold">{editCampaign ? 'Edit Campaign' : 'New Campaign'}</h2>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left: Campaign info */}
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold">Campaign Details</h3>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Q1 Outreach — Engineering Leaders"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Description</label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Optional description..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Stop on reply</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">Pause sequence when lead replies</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormStopOnReply(!formStopOnReply)}
                    className={cx(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      formStopOnReply ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700',
                    )}
                  >
                    <span
                      className={cx(
                        'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                        formStopOnReply ? 'translate-x-6' : 'translate-x-1',
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={saveCampaign}
              disabled={!formName.trim() || !formSteps.length}
              className={cx(
                'w-full rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition',
                formName.trim() && formSteps.length
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600',
              )}
            >
              {editCampaign ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>

          {/* Right: Step builder */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Sequence Steps</h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">{formSteps.length} steps</span>
              </div>

              {/* Step timeline */}
              <div className="mt-5 space-y-3">
                {formSteps.map((step, idx) => {
                  const meta = ACTION_META[step.action_type] || ACTION_META.wait;
                  return (
                    <div key={idx} className="group relative">
                      {/* Connector line */}
                      {idx > 0 && (
                        <div className="absolute left-5 -top-3 h-3 w-px bg-slate-300 dark:bg-slate-700" />
                      )}

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-start gap-3">
                          {/* Step badge */}
                          <div className={cx('flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white text-sm', meta.color)}>
                            {meta.emoji}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Step {step.step_order}</span>
                              <span className="text-xs font-semibold">{meta.label}</span>
                            </div>

                            {/* Delay config */}
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-slate-500 dark:text-slate-400">Delay:</span>
                              <input
                                type="number"
                                min={0}
                                max={90}
                                value={step.delay_days}
                                onChange={(e) => updateStep(idx, { delay_days: Number(e.target.value) || 0 })}
                                className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-center dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              />
                              <span className="text-xs text-slate-500">d</span>
                              <input
                                type="number"
                                min={0}
                                max={23}
                                value={step.delay_hours}
                                onChange={(e) => updateStep(idx, { delay_hours: Number(e.target.value) || 0 })}
                                className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-center dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              />
                              <span className="text-xs text-slate-500">h</span>
                            </div>

                            {/* Action-specific config */}
                            {step.action_type === 'connect' && (
                              <div className="mt-3">
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Connection Note</label>
                                <textarea
                                  value={step.config_json?.note || ''}
                                  onChange={(e) => updateStep(idx, { config_json: { ...step.config_json, note: e.target.value } })}
                                  placeholder="Hi {{first_name}}, I'd love to connect..."
                                  rows={2}
                                  maxLength={300}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs resize-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                />
                                <div className="mt-1 text-right text-xs text-slate-400">{(step.config_json?.note || '').length}/300</div>
                              </div>
                            )}

                            {step.action_type === 'message' && (
                              <div className="mt-3">
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Message Body</label>
                                <textarea
                                  value={step.config_json?.body || ''}
                                  onChange={(e) => updateStep(idx, { config_json: { ...step.config_json, body: e.target.value } })}
                                  placeholder="Hey {{first_name}}, I noticed you..."
                                  rows={3}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs resize-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                />
                              </div>
                            )}
                          </div>

                          {/* Step actions */}
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => moveStep(idx, 'up')}
                              disabled={idx === 0}
                              className="rounded p-1 text-xs hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveStep(idx, 'down')}
                              disabled={idx === formSteps.length - 1}
                              className="rounded p-1 text-xs hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => removeStep(idx)}
                              className="rounded p-1 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add step buttons */}
              <div className="mt-5">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Add step:</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ACTION_META).map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => addStep(key as CampaignStep['action_type'])}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900 transition"
                    >
                      <span>{meta.emoji}</span> {meta.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  Render: Campaign Detail                                          */
  /* ================================================================ */

  function renderDetail() {
    if (!detailCampaign) return null;
    const stats = campaignStats(detailCampaign);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setView('list'); setDetailCampaign(null); }}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold truncate">{detailCampaign.name}</h2>
              <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_COLORS[detailCampaign.status])}>
                {detailCampaign.status}
              </span>
            </div>
            {detailCampaign.description && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 truncate">{detailCampaign.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {detailCampaign.status === 'draft' && (
              <button
                onClick={() => toggleStatus(detailCampaign, 'active')}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition"
              >
                Activate
              </button>
            )}
            {detailCampaign.status === 'active' && (
              <button
                onClick={() => toggleStatus(detailCampaign, 'paused')}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 transition"
              >
                Pause
              </button>
            )}
            {detailCampaign.status === 'paused' && (
              <button
                onClick={() => toggleStatus(detailCampaign, 'active')}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition"
              >
                Resume
              </button>
            )}
            <button
              onClick={() => openEdit(detailCampaign)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 transition"
            >
              Edit
            </button>
            {['draft', 'archived'].includes(detailCampaign.status) && (
              <button
                onClick={() => deleteCampaign(detailCampaign)}
                className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:hover:bg-rose-950 transition"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Steps + Stats */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold">Funnel</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Active', value: stats.active, color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Completed', value: stats.completed, color: 'text-blue-600 dark:text-blue-400' },
                  { label: 'Replied', value: stats.replied, color: 'text-indigo-600 dark:text-indigo-400' },
                  { label: 'Total', value: stats.total, color: 'text-slate-900 dark:text-slate-100' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                    <div className={cx('text-xl font-bold', s.color)}>{s.value}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step timeline */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold">Steps</h3>
              <div className="mt-4 space-y-2">
                {detailSteps.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">No steps defined.</p>
                ) : (
                  detailSteps.map((step, idx) => {
                    const meta = ACTION_META[step.action_type] || ACTION_META.wait;
                    const delay = step.delay_days > 0 || step.delay_hours > 0
                      ? `${step.delay_days}d ${step.delay_hours}h`
                      : 'Immediate';
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className={cx('flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs', meta.color)}>
                          {meta.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold">{meta.label}</div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">{delay}</div>
                        </div>
                        <span className="text-xs text-slate-400">#{step.step_order}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right: Enrollments */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">
                  Enrollments <span className="text-slate-400 font-normal">({enrollTotal})</span>
                </h3>
                <button
                  onClick={() => setShowEnrollModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                >
                  + Enroll Profiles
                </button>
              </div>

              {/* Enrollment list */}
              <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto">
                {enrollments.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="text-2xl">👥</div>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      No profiles enrolled yet. Click &quot;Enroll Profiles&quot; to add LinkedIn URLs.
                    </p>
                  </div>
                ) : (
                  enrollments.map((e) => {
                    const meta = ACTION_META[detailSteps[e.current_step_order - 1]?.action_type || 'wait'] || ACTION_META.wait;
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                      >
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-300">
                          {(e.profile_name || e.profile_url || '?')[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">
                            {e.profile_name || e.profile_url}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            Step {e.current_step_order}/{detailSteps.length}
                            {e.next_step_at && ` · Next: ${formatDate(e.next_step_at)}`}
                          </div>
                        </div>
                        <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_COLORS[e.status] || STATUS_COLORS.active)}>
                          {e.status}
                        </span>
                        {(e.status === 'active' || e.status === 'paused') && (
                          <button
                            onClick={() => toggleEnrollment(e)}
                            className="rounded-lg p-1.5 text-xs hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                            title={e.status === 'paused' ? 'Resume' : 'Pause'}
                          >
                            {e.status === 'paused' ? '▶' : '⏸'}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Enroll Modal */}
        {showEnrollModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowEnrollModal(false)}>
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold">Enroll Profiles</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Paste LinkedIn profile URLs below, one per line.
              </p>
              <textarea
                value={enrollInput}
                onChange={(e) => setEnrollInput(e.target.value)}
                placeholder={`https://linkedin.com/in/john-doe\nhttps://linkedin.com/in/jane-smith`}
                rows={8}
                className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {enrollInput.split('\n').filter((l) => l.trim()).length} URLs detected
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowEnrollModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={enrollProfiles}
                  disabled={enrollLoading || !enrollInput.trim()}
                  className={cx(
                    'rounded-xl px-5 py-2 text-sm font-semibold text-white transition',
                    enrollLoading || !enrollInput.trim()
                      ? 'bg-slate-300 cursor-not-allowed dark:bg-slate-700'
                      : 'bg-indigo-600 hover:bg-indigo-500',
                  )}
                >
                  {enrollLoading ? 'Enrolling...' : 'Enroll'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ================================================================ */
  /*  Main render — full-screen overlay                                */
  /* ================================================================ */

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Toast {...toast} />

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={view === 'list' ? onClose : () => setView('list')}
          className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm">
          🔗
        </div>
        <div>
          <h1 className="text-lg font-bold">Campaign Sequences</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Multi-step LinkedIn outreach automation</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl">
          {view === 'list' && renderList()}
          {view === 'create' && renderCreateEdit()}
          {view === 'detail' && renderDetail()}
        </div>
      </div>
    </div>
  );
}

