import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export default function ShareJobModal({ job, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [share, setShare] = useState(null);
  const [copy, setCopy] = useState('');
  const [attach, setAttach] = useState(false);
  const [applyMode, setApplyMode] = useState('hirepilot');
  const [applyUrl, setApplyUrl] = useState('');

  const shareUrl = useMemo(() => share?.share_id ? `${window.location.origin}/jobs/share/${share.share_id}` : '' , [share]);

  const fetchOrCreateShare = async (opts = {}) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/jobs/${job.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(opts)
      });
      const js = await resp.json();
      if (resp.ok) {
        setShare(js);
        if (!copy) setCopy(buildDefaultCopy(job, js.public_url || `${window.location.origin}/jobs/share/${js.share_id}`));
        if (opts && opts._action === 'publish') {
          toast.success('Job published successfully!');
        } else if (opts && opts._action === 'regenerate') {
          toast.success('Share link regenerated');
        }
        return js;
      } else {
        console.error('share error', js);
        toast.error(js?.error || 'Failed to publish job');
        return null;
      }
    } catch (e) {
      console.error('share request failed', e);
      toast.error('Network error while saving. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open && job?.id) fetchOrCreateShare(); }, [open, job?.id]);

  const regenerateLink = async () => {
    const ok = await fetchOrCreateShare({ apply_mode: applyMode, apply_url: applyMode === 'external' ? applyUrl : null, regenerate: true, _action: 'regenerate' });
    if (!ok) return;
  };
  const publishAndShare = async () => {
    const res = await fetchOrCreateShare({ apply_mode: applyMode, apply_url: applyMode === 'external' ? applyUrl : null, _action: 'publish' });
    if (res) {
      onClose?.();
    }
  };

  const regenerateAICopy = async () => {
    try {
      if (!job?.id) return;
      const link = shareUrl || `${window.location.origin}/job/${job.id}`;
      setLoading(true);
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/jobs/${job.id}/generate-social-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link })
      });
      const js = await resp.json();
      if (resp.ok && js?.text) {
        setCopy(js.text);
        toast.success('Draft regenerated');
      } else {
        toast.error(js?.error || 'Failed to regenerate draft');
      }
    } catch (e) {
      toast.error('Failed to regenerate draft');
    } finally {
      setLoading(false);
    }
  };

  const buildDefaultCopy = (job, link) => {
    const parts = [
      `We're hiring a ${job?.title || 'great teammate'}!`,
      job?.location ? `Location: ${job.location}` : null,
      'Apply here:',
      link
    ].filter(Boolean);
    return parts.join('\n');
  };

  if (!open) return null;

  const linkedInHref = shareUrl ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}` : '#';
  const xHref = shareUrl ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(copy || shareUrl)}` : '#';
  const facebookHref = shareUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(copy || '')}` : '#';

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all" role="dialog" aria-modal="true" aria-labelledby="modal-headline">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 p-2 rounded-lg"><i className="fa-solid fa-share-nodes text-indigo-600 text-xl"></i></div>
            <div>
              <h2 id="modal-headline" className="text-xl font-bold text-slate-800">Share Job Posting</h2>
              <p className="text-sm text-slate-500">{job?.title || ''}</p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 transition-colors" onClick={onClose}><i className="fa-solid fa-xmark text-2xl"></i></button>
        </div>

        <div className="p-8 space-y-8">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-2">Shareable Link</label>
            <div className="flex items-center space-x-2">
              <input type="text" readOnly value={shareUrl} className="flex-grow bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" />
              <button className="bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-all duration-200 flex items-center space-x-2" onClick={() => { if (shareUrl) { navigator.clipboard.writeText(shareUrl); toast.success('Link copied'); } else { toast.error('No link yet'); } }}>
                <i className="fa-regular fa-copy"></i><span>Copy</span>
              </button>
              <button className="px-3 py-2 rounded-lg border text-sm" onClick={regenerateLink} disabled={loading}>Regenerate</button>
            </div>
          </div>

          <div className="border-t border-slate-200"></div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-slate-800">AI Drafted Post</h3>
              <div className="space-x-2">
                <button className="px-3 py-1.5 text-sm border rounded-lg" onClick={regenerateAICopy} disabled={loading}>Regenerate</button>
                <button className="px-3 py-1.5 text-sm border rounded-lg" onClick={() => { if (copy) { navigator.clipboard.writeText(copy); toast.success('Text copied'); } else { toast.error('Nothing to copy'); } }}>Copy</button>
              </div>
            </div>
            <textarea className="w-full min-h-[120px] bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" value={copy} onChange={(e)=>setCopy(e.target.value)} />
            <div className="mt-3 flex items-center gap-3 text-sm">
              <a href={linkedInHref} target="_blank" rel="noopener noreferrer" className="w-12 h-12 flex items-center justify-center border rounded-lg hover:bg-slate-50" title="Share on LinkedIn">
                <i className="fa-brands fa-linkedin"></i>
              </a>
              <a href={xHref} target="_blank" rel="noopener noreferrer" className="w-12 h-12 flex items-center justify-center border rounded-lg hover:bg-slate-50" title="Share on X">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4L20 20"/>
                  <path d="M20 4L4 20"/>
                </svg>
              </a>
              <a href={facebookHref} target="_blank" rel="noopener noreferrer" className="w-12 h-12 flex items-center justify-center border rounded-lg hover:bg-slate-50" title="Share on Facebook">
                <i className="fa-brands fa-facebook"></i>
              </a>
            </div>
          </div>

          <div className="border-t border-slate-200"></div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-base font-semibold text-slate-800">Attach Apply Form</h3>
                <p className="text-sm text-slate-500">Allow candidates to apply directly from the shared link.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={attach} onChange={(e)=>setAttach(e.target.checked)} />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {attach && (
              <div className="pl-4 border-l-2 border-indigo-100 space-y-6">
                <label className={`flex items-start p-4 rounded-lg cursor-pointer transition ${applyMode==='hirepilot' ? 'border-2 border-indigo-600 bg-indigo-50' : 'border border-slate-200'}`}
                  onClick={()=>setApplyMode('hirepilot')}>
                  <input type="radio" name="apply_option" className="mt-1 h-4 w-4 text-indigo-600" checked={applyMode==='hirepilot'} readOnly />
                  <div className="ml-4 flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">Use HirePilot Form</span>
                    <p className="text-sm text-slate-500 mt-1">Use our optimized application form. Submissions are automatically added to your pipeline.</p>
                    <div className="mt-3 flex items-center space-x-2 text-xs text-gray-500">
                      <span className="bg-white border border-gray-200 rounded-full px-2 py-0.5">Name</span>
                      <span className="bg-white border border-gray-200 rounded-full px-2 py-0.5">Email</span>
                      <span className="bg-white border border-gray-200 rounded-full px-2 py-0.5">LinkedIn</span>
                      <span className="bg-white border border-gray-200 rounded-full px-2 py-0.5">Resume</span>
                    </div>
                  </div>
                </label>

                <label className={`flex items-start p-4 rounded-lg cursor-pointer transition ${applyMode==='external' ? 'border-2 border-indigo-600 bg-indigo-50' : 'border border-slate-200'}`}
                  onClick={()=>setApplyMode('external')}>
                  <input type="radio" name="apply_option" className="mt-1 h-4 w-4 text-indigo-600" checked={applyMode==='external'} readOnly />
                  <div className="ml-4 flex flex-col w-full">
                    <span className="text-sm font-semibold text-slate-800">Use External Form Link</span>
                    <p className="text-sm text-slate-500 mt-1">Redirect applicants to an external URL. We will still track apply clicks.</p>
                    <div className="mt-4">
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><i className="fa-solid fa-link text-gray-400"></i></div>
                        <input type="url" placeholder="https://your-application-form.com" className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" value={applyUrl} onChange={(e)=>setApplyUrl(e.target.value)} disabled={applyMode!=='external'} />
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 px-8 py-5 flex justify-end items-center rounded-b-xl">
          <button disabled={loading} onClick={publishAndShare} className="bg-indigo-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-all duration-200 flex items-center space-x-2">
            <i className="fa-solid fa-check"></i><span>{loading ? 'Saving…' : 'Publish & Share'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
