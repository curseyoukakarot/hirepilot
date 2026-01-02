import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const resp = await fetch(path, { ...options, headers, credentials: 'include' });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export default function SniperIntelligence() {
  const [workflow, setWorkflow] = useState('sniper-indeed-hiring-managers');
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [platform, setPlatform] = useState('indeed'); // indeed|ziprecruiter|google_jobs
  const [tiktokMode, setTiktokMode] = useState('creator_search'); // creator_search|post_engagement
  const [tiktokQuery, setTiktokQuery] = useState('');
  const [tiktokVideoUrl, setTikTokVideoUrl] = useState('');
  const [runId, setRunId] = useState('');
  const [run, setRun] = useState(null);
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState('jobs');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const rid = url.searchParams.get('run');
    if (rid) setRunId(rid);
  }, []);

  useEffect(() => {
    let timer;
    if (runId) {
      setPolling(true);
      const poll = async () => {
        try {
          const r = await apiFetch(`/api/sniper/runs/${runId}`);
          setRun(r);
          const rs = await apiFetch(`/api/sniper/runs/${runId}/results?limit=500`);
          setResults(rs.results || []);
          if (r.status === 'completed' || r.status === 'failed') {
            setPolling(false);
            return;
          }
        } catch {
          setPolling(false);
        }
        timer = setTimeout(poll, 3000);
      };
      poll();
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [runId]);

  const jobRows = useMemo(() => results.filter(r => ['indeed_job','zip_job','google_job'].includes(r.source_type)), [results]);
  const tiktokRows = useMemo(() => results.filter(r => r.source_type.startsWith('tiktok_')), [results]);

  async function startJobDiscovery() {
    setLoading(true);
    try {
      const body = {
        workflow_slug: workflow,
        params: { platform, job_title: jobTitle, location, max_results: 100 }
      };
      const resp = await apiFetch('/api/sniper/runs', { method: 'POST', body: JSON.stringify(body) });
      setRunId(resp.run_id);
      setTab('jobs');
    } catch (e) {
      alert(e.message || 'Failed to start');
    }
    setLoading(false);
  }

  async function startTikTokDiscovery() {
    setLoading(true);
    try {
      const params = tiktokMode === 'creator_search'
        ? { mode: 'creator_search', query: tiktokQuery, max_results: 100 }
        : { mode: 'post_engagement', video_url: tiktokVideoUrl, include_commenters: true, include_likers: true, max_results: 200 };
      const resp = await apiFetch('/api/sniper/runs', { method: 'POST', body: JSON.stringify({ workflow_slug: 'sniper-tiktok-discovery', params }) });
      setRunId(resp.run_id);
      setTab('tiktok');
    } catch (e) {
      alert(e.message || 'Failed to start');
    }
    setLoading(false);
  }

  const toggleSelected = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="p-6 text-gray-200">
      <h1 className="text-2xl font-bold mb-3">Sniper Intelligence</h1>

      <div className="flex gap-3 mb-4">
        <button className={`px-3 py-2 rounded ${tab==='jobs'?'bg-blue-600':'bg-slate-700'}`} onClick={()=>setTab('jobs')}>Jobs</button>
        <button className={`px-3 py-2 rounded ${tab==='tiktok'?'bg-blue-600':'bg-slate-700'}`} onClick={()=>setTab('tiktok')}>TikTok</button>
        <button className={`px-3 py-2 rounded ${tab==='logs'?'bg-blue-600':'bg-slate-700'}`} onClick={()=>setTab('logs')}>Logs/Credits</button>
      </div>

      {tab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div>
              <label className="text-sm text-gray-400">Platform</label>
              <select className="bg-slate-800 p-2 rounded" value={platform} onChange={(e)=>setPlatform(e.target.value)}>
                <option value="indeed">Indeed</option>
                <option value="ziprecruiter">ZipRecruiter</option>
                <option value="google_jobs">Google Jobs</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400">Job Title</label>
              <input className="bg-slate-800 p-2 rounded" value={jobTitle} onChange={(e)=>setJobTitle(e.target.value)} placeholder="Account Executive" />
            </div>
            <div>
              <label className="text-sm text-gray-400">Location</label>
              <input className="bg-slate-800 p-2 rounded" value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Baltimore, MD" />
            </div>
            <button className="px-3 py-2 bg-blue-600 rounded" onClick={startJobDiscovery} disabled={loading}>{loading ? 'Starting...' : 'Run Discovery'}</button>
            <div className="ml-auto text-xs text-gray-400">Decision-maker enrichment is deprecated for v1.</div>
          </div>

          <div className="rounded border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800">
                <tr>
                  <th className="p-2"></th>
                  <th className="text-left p-2">Job Title</th>
                  <th className="text-left p-2">Company</th>
                  <th className="text-left p-2">Location</th>
                  <th className="text-left p-2">Posted</th>
                  <th className="text-left p-2">Salary</th>
                  <th className="text-left p-2">Platform</th>
                  <th className="text-left p-2">Link</th>
                </tr>
              </thead>
              <tbody>
                {jobRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-700">
                    <td className="p-2">
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={()=>toggleSelected(r.id)} />
                    </td>
                    <td className="p-2">{r.normalized?.job_title}</td>
                    <td className="p-2">{r.normalized?.company_name}</td>
                    <td className="p-2">{r.normalized?.location}</td>
                    <td className="p-2">{r.normalized?.posting_date}</td>
                    <td className="p-2">{r.normalized?.salary}</td>
                    <td className="p-2">{r.normalized?.source_platform}</td>
                    <td className="p-2"><a className="text-blue-400" href={r.normalized?.job_url} target="_blank" rel="noreferrer">Open</a></td>
                  </tr>
                ))}
                {jobRows.length === 0 && (
                  <tr><td colSpan={8} className="p-4 text-center text-gray-400">{polling ? 'Loading...' : 'No results yet'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'tiktok' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div>
              <label className="text-sm text-gray-400">Mode</label>
              <select className="bg-slate-800 p-2 rounded" value={tiktokMode} onChange={(e)=>setTiktokMode(e.target.value)}>
                <option value="creator_search">Discover Creators</option>
                <option value="post_engagement">Post Engagement</option>
              </select>
            </div>
            {tiktokMode === 'creator_search' ? (
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-sm text-gray-400">Query / Hashtag</label>
                  <input className="bg-slate-800 p-2 rounded" value={tiktokQuery} onChange={(e)=>setTiktokQuery(e.target.value)} placeholder="recruiting tips" />
                </div>
                <button className="px-3 py-2 bg-blue-600 rounded" onClick={startTikTokDiscovery} disabled={loading}>{loading ? 'Starting...' : 'Run Discovery'}</button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-sm text-gray-400">Video URL</label>
                  <input className="bg-slate-800 p-2 rounded" value={tiktokVideoUrl} onChange={(e)=>setTikTokVideoUrl(e.target.value)} placeholder="https://www.tiktok.com/@user/video/..." />
                </div>
                <button className="px-3 py-2 bg-blue-600 rounded" onClick={startTikTokDiscovery} disabled={loading}>{loading ? 'Starting...' : 'Run Discovery'}</button>
              </div>
            )}
          </div>
          <div className="rounded border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800">
                <tr>
                  <th className="text-left p-2">Handle</th>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Profile</th>
                  <th className="text-left p-2">Video</th>
                  <th className="text-left p-2">Comment</th>
                </tr>
              </thead>
              <tbody>
                {tiktokRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-700">
                    <td className="p-2">@{r.normalized?.tiktok_handle}</td>
                    <td className="p-2">{r.normalized?.display_name}</td>
                    <td className="p-2"><a className="text-blue-400" href={r.normalized?.profile_url} target="_blank" rel="noreferrer">Open</a></td>
                    <td className="p-2">{r.normalized?.video_url ? <a className="text-blue-400" href={r.normalized?.video_url} target="_blank" rel="noreferrer">Video</a> : '-'}</td>
                    <td className="p-2">{r.normalized?.comment_text || '-'}</td>
                  </tr>
                ))}
                {tiktokRows.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-gray-400">{polling ? 'Loading...' : 'No results yet'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="space-y-2">
          <div>Status: <span className="font-mono">{run?.status || '-'}</span></div>
          <div>Discovered: <span className="font-mono">{run?.discovered_count || 0}</span></div>
          <div>Run ID: <span className="font-mono">{runId || '-'}</span></div>
          {run?.error && <div className="text-red-400">Error: {run.error}</div>}
        </div>
      )}
    </div>
  );
}


