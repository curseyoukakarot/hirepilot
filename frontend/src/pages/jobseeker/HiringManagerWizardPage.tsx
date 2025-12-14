import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

type TitleChip = { title: string; confidence: 'High' | 'Medium' | 'Low'; reasoning?: string };
type WizardState = {
  step: 1 | 2 | 3;
  jobDescription: string;
  company: string;
  companySize: string;
  industry: string;
  inferredTitles: TitleChip[];
  selectedTitles: TitleChip[];
  leadSource: 'apollo' | 'sales_navigator' | null;
};

const initialState: WizardState = {
  step: 1,
  jobDescription: '',
  company: '',
  companySize: '',
  industry: '',
  inferredTitles: [],
  selectedTitles: [],
  leadSource: null,
};

const sizeOptions = ['1–10', '11–50', '51–200', '201–1,000', '1,001–5,000', '5,000+'];

export default function HiringManagerWizardPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<WizardState>(initialState);
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // persist locally
  useEffect(() => {
    const key = 'hm_wizard';
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        setState((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const key = 'hm_wizard';
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [state]);

  const stepLabel = useMemo(() => `Step ${state.step} of 3`, [state.step]);

  const callInfer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/jobs/hiring-manager-infer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          job_description: state.jobDescription,
          company_size: state.companySize,
          industry: state.industry,
          company_name: state.company,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Inference failed');
      }
      const data = await res.json();
      const titles = (data?.titles || []) as TitleChip[];
      setState((prev) => ({
        ...prev,
        inferredTitles: titles,
        selectedTitles: titles,
      }));
      setState((prev) => ({ ...prev, step: 2 }));
    } catch (e: any) {
      setError(e?.message || 'Failed to analyze');
    } finally {
      setLoading(false);
    }
  }, [state.jobDescription, state.companySize, state.industry, state.company]);

  const handleRemoveTitle = (title: string) => {
    setState((prev) => ({
      ...prev,
      selectedTitles: prev.selectedTitles.filter((t) => t.title !== title),
    }));
  };

  const handleAddTitle = (title: string) => {
    if (!title.trim()) return;
    setState((prev) => ({
      ...prev,
      selectedTitles: [...prev.selectedTitles, { title: title.trim(), confidence: 'Medium' }],
    }));
  };

  const handleLaunch = async () => {
    let timer: any;
    try {
      setLaunching(true);
      setShowLaunchModal(true);
      setLaunchProgress(10);
      timer = window.setInterval(() => {
        setLaunchProgress((p) => Math.min(92, p + Math.random() * 8 + 4));
      }, 320);
      setError(null);
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/jobs/hiring-manager-launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          job_description: state.jobDescription,
          company_name: state.company,
          company_size: state.companySize,
          industry: state.industry,
          selected_titles: state.selectedTitles,
          campaign_title: state.company ? `HM Outreach: ${state.company}` : 'Hiring Manager Outreach',
          leadSource: state.leadSource || 'apollo',
        }),
      });
      if (!res.ok) {
        let detail = 'Launch failed';
        try {
          const errJson = await res.json();
          if (errJson?.code === 'APOLLO_KEY_MISSING') {
            detail = 'Connect your Apollo API key in Integrations to launch.';
          } else if (errJson?.code === 'NO_LEADS_FOUND') {
            detail =
              errJson?.suggestions?.join(' ') ||
              'No leads found. Try broader titles (VP/Director/Head) or remove strict company filter.';
          } else if (errJson?.error) {
            detail = errJson.error;
          }
        } catch {
          detail = await res.text();
        }
        throw new Error(detail || 'Launch failed');
      }
      const js = await res.json();
      setLaunchProgress(100);
      toast.success(`Campaign launched. Leads added: ${js?.leads_inserted ?? js?.leads_sourced ?? 0}`);
      setTimeout(() => {
        setShowLaunchModal(false);
        navigate('/campaigns');
      }, 450);
    } catch (e: any) {
      setError(e?.message || 'Failed to launch');
      setShowLaunchModal(false);
    } finally {
      if (timer) window.clearInterval(timer);
      setLaunching(false);
    }
  };

  return (
    <div className="bg-gray-900 text-gray-100 font-inter min-h-screen">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-robot text-white text-sm" />
            </div>
            <h1 className="text-xl font-semibold text-white">Hiring Manager Outreach Wizard</h1>
          </div>
          <button className="text-gray-400 hover:text-gray-300" onClick={() => navigate('/campaigns')}>
            <i className="fas fa-times text-xl" />
          </button>
        </div>
      </header>

      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Find the hiring manager — and reach them directly</h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Paste a job description and REX will infer who likely owns the role based on role type, company size, and industry.
          </p>
          <div className="mt-8">
            <div className="flex items-center justify-center space-x-8">
              {[1, 2, 3].map((n) => {
                const active = state.step === n;
                const complete = state.step > n;
                return (
                  <div key={n} className="flex items-center">
                    <div
                      className={[
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                        complete ? 'bg-green-600 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400',
                      ].join(' ')}
                    >
                      {complete ? <i className="fas fa-check" /> : n}
                    </div>
                    <span
                      className={[
                        'ml-2 text-sm font-medium',
                        complete ? 'text-green-400' : active ? 'text-indigo-400' : 'text-gray-500',
                      ].join(' ')}
                    >
                      Step {n} of 3
                    </span>
                    {n < 3 && <div className="w-16 h-0.5 bg-gray-700 ml-3" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {state.step === 1 && (
          <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 p-8">
            <h3 className="text-2xl font-bold text-white mb-6">Step 1: Add the job description</h3>
            <div className="mb-8">
              <p className="text-gray-300 mb-4">Paste the job description below. REX will:</p>
              <ul className="text-gray-300 space-y-2 ml-4">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  create a Job + Job Requisition automatically
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  identify the most likely hiring manager titles for this role
                </li>
              </ul>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Job description <span className="text-red-400">*</span>
                </label>
                <textarea
                  className="w-full h-40 px-4 py-3 bg-gray-900 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none placeholder-gray-500"
                  placeholder="Paste the full job description here…"
                  value={state.jobDescription}
                  onChange={(e) => setState((p) => ({ ...p, jobDescription: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Company <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500"
                  placeholder="e.g., Notion, Stripe, Amazon"
                  value={state.company}
                  onChange={(e) => setState((p) => ({ ...p, company: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Company size <span className="text-gray-500">(optional but recommended)</span>
                </label>
                <p className="text-sm text-gray-400 mb-3">Helps REX choose the right hiring manager titles (Director vs VP vs Head of…)</p>
                <select
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={state.companySize}
                  onChange={(e) => setState((p) => ({ ...p, companySize: e.target.value }))}
                >
                  <option value="">Select company size</option>
                  {sizeOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {!state.companySize && (
                  <p className="text-xs text-gray-500 mt-2">Add company size for more accurate targeting.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Industry <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500"
                  placeholder="e.g., B2B SaaS, Healthcare, FinTech, E-commerce"
                  value={state.industry}
                  onChange={(e) => setState((p) => ({ ...p, industry: e.target.value }))}
                />
              </div>
              {error && <div className="text-red-400 text-sm">{error}</div>}
              <div className="flex space-x-4 pt-6">
                <button
                  type="button"
                  className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
                  onClick={callInfer}
                  disabled={!state.jobDescription || loading}
                >
                  {loading ? 'Analyzing…' : 'Analyze & continue'}
                </button>
                <button
                  type="button"
                  className="px-6 py-3 text-gray-400 font-medium hover:text-gray-300 transition-colors"
                  onClick={() => setState((p) => ({ ...p, step: 2 }))}
                >
                  Skip for now
                </button>
              </div>
            </div>

            {state.inferredTitles.length > 0 && (
              <div className="mt-8 bg-gray-800 rounded-xl shadow-xl border border-gray-700 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-2">Likely hiring manager titles</h4>
                    <p className="text-gray-400">
                      Based on this role + company context, these are the most likely owners of the position.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mb-6">
                  {state.selectedTitles.map((t) => (
                    <div
                      key={t.title}
                      className="inline-flex items-center bg-slate-800 border border-slate-700 rounded-full px-4 py-2"
                    >
                      <span className="text-slate-100 font-medium">{t.title}</span>
                      <span className="ml-2 text-xs bg-slate-700 text-slate-200 px-2 py-1 rounded-full">
                        {t.confidence} confidence
                      </span>
                      <button
                        className="ml-2 text-xs text-slate-400 hover:text-red-400"
                        onClick={() => handleRemoveTitle(t.title)}
                      >
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  ))}
                </div>
                <TitleInput onAdd={handleAddTitle} />
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6 mt-4">
                  <p className="text-sm text-blue-300">
                    <i className="fas fa-info-circle mr-2"></i>
                    These are best-fit titles — your outreach can target multiple owners to increase reply rates.
                  </p>
                </div>
                <button
                  className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                  onClick={() => setState((p) => ({ ...p, step: 2 }))}
                >
                  Continue to lead source
                </button>
              </div>
            )}
          </div>
        )}

        {state.step === 2 && (
          <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 p-8 space-y-6">
            <h3 className="text-2xl font-bold text-white mb-2">Step 2: Choose where to find hiring managers</h3>
            <p className="text-gray-300 mb-4">
              Pick a lead source to find people matching the titles above. You can use Apollo for fast results or Sales Navigator if
              you already have access.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <LeadCard
                title="Apollo"
                bullets={['Fast sourcing + email enrichment', 'Recommended for most users']}
                active={state.leadSource === 'apollo'}
                onSelect={() => setState((p) => ({ ...p, leadSource: 'apollo' }))}
              />
              <LeadCard
                title="Sales Navigator"
                bullets={[
                  'Requires a LinkedIn Sales Navigator subscription',
                  'Requires the HirePilot Chrome Extension',
                ]}
                active={state.leadSource === 'sales_navigator'}
                onSelect={() => setState((p) => ({ ...p, leadSource: 'sales_navigator' }))}
              />
            </div>
            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4">
              <p className="text-sm text-amber-300">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                Sales Navigator requires an active Sales Nav account. If you don&apos;t have one, use Apollo.
              </p>
            </div>
            <div className="flex justify-between pt-2">
              <button
                className="px-6 py-3 text-gray-400 font-medium hover:text-gray-300 transition-colors"
                onClick={() => setState((p) => ({ ...p, step: 1 }))}
              >
                Back
              </button>
              <button
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
                disabled={!state.leadSource}
                onClick={() => setState((p) => ({ ...p, step: 3 }))}
              >
                Continue to review
              </button>
            </div>
          </div>
        )}

        {state.step === 3 && (
          <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 p-8 space-y-6">
            <h3 className="text-2xl font-bold text-white mb-2">Step 3: Review & launch</h3>
            <div className="space-y-4 text-sm">
              <div className="border border-gray-700 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">Job</h4>
                <p className="text-gray-300">Job title: inferred from JD</p>
                {state.company && <p className="text-gray-300">Company: {state.company}</p>}
                {state.industry && <p className="text-gray-300">Industry: {state.industry}</p>}
              </div>
              <div className="border border-gray-700 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">Hiring manager targeting</h4>
                <div className="flex flex-wrap gap-2">
                  {state.selectedTitles.map((t) => (
                    <span key={t.title} className="px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-100">
                      {t.title}
                    </span>
                  ))}
                </div>
              </div>
              <div className="border border-gray-700 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">Lead source</h4>
                <p className="text-gray-300">
                  {state.leadSource === 'apollo' ? 'Apollo' : state.leadSource === 'sales_navigator' ? 'Sales Navigator' : 'Not selected'}
                </p>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <div className="space-x-3">
                <button
                  className="px-6 py-3 text-gray-400 font-medium hover:text-gray-300 transition-colors"
                  onClick={() => setState((p) => ({ ...p, step: 1 }))}
                >
                  Edit job description
                </button>
                <button
                  className="px-6 py-3 text-gray-400 font-medium hover:text-gray-300 transition-colors"
                  onClick={() => setState((p) => ({ ...p, step: 2 }))}
                >
                  Edit lead source
                </button>
              </div>
              <button
                  className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
                  onClick={handleLaunch}
                  disabled={!state.leadSource || state.selectedTitles.length === 0 || launching}
              >
                Launch hiring manager outreach
              </button>
            </div>
            <p className="text-xs text-gray-400">
              You can refine targeting after launch — this just gets you moving fast.
            </p>
          </div>
        )}
      </main>

      {showLaunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-700 flex items-center justify-center">
                <i className="fas fa-rocket text-white" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white">Launching campaign…</h4>
                <p className="text-sm text-gray-400">Sourcing hiring managers and creating your campaign.</p>
              </div>
            </div>
            <div className="w-full h-3 rounded-full bg-gray-800 overflow-hidden border border-gray-700">
              <div
                className="h-full bg-gradient-to-r from-indigo-400 via-indigo-500 to-blue-400 transition-all duration-200"
                style={{ width: `${Math.min(launchProgress, 100)}%` }}
              />
            </div>
            <div className="text-right text-xs text-gray-400 mt-2">{Math.round(Math.min(launchProgress, 100))}%</div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadCard({
  title,
  bullets,
  active,
  onSelect,
}: {
  title: string;
  bullets: string[];
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={[
        'border rounded-xl p-6 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group',
        active ? 'border-indigo-500 bg-gray-750' : 'border-gray-700 bg-gray-750',
      ].join(' ')}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-purple-900/50 rounded-lg flex items-center justify-center">
          <i className={`text-xl ${title === 'Apollo' ? 'fas fa-rocket text-purple-400' : 'fab fa-linkedin text-blue-400'}`} />
        </div>
        <div className={['w-6 h-6 border-2 rounded-full', active ? 'border-indigo-400 bg-indigo-500' : 'border-gray-600'].join(' ')}></div>
      </div>
      <h4 className="text-lg font-semibold text-white mb-2">{title}</h4>
      <ul className="text-gray-300 space-y-1 mb-6">
        {bullets.map((b) => (
          <li key={b} className="flex items-center">
            <i className="fas fa-check text-green-400 mr-2 text-sm"></i>
            {b}
          </li>
        ))}
      </ul>
      <button className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
        Use {title}
      </button>
    </div>
  );
}

function TitleInput({ onAdd }: { onAdd: (val: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex gap-3">
      <input
        className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500"
        placeholder="Add another title"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAdd(value);
            setValue('');
          }
        }}
      />
      <button
        className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 hover:bg-slate-750"
        onClick={() => {
          onAdd(value);
          setValue('');
        }}
      >
        Add
      </button>
    </div>
  );
}
