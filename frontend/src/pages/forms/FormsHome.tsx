import React, { useEffect, useMemo, useState } from 'react';
import { createForm, listForms } from '../../lib/api/forms';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../../styles/forms.css';

export default function FormsHome() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await listForms();
        if (!mounted) return;
        setItems(data.items || []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function handleCreate() {
    const f = await createForm({ title: 'Untitled Form', is_public: true });
    setItems(prev => [f, ...prev]);
    try { navigate(`/forms/${f.id}`); } catch {}
  }

  const filtered = useMemo(() => {
    const t = (q || '').toLowerCase();
    if (!t) return items;
    return items.filter((f) => String(f.title || '').toLowerCase().includes(t) || String(f.slug || '').toLowerCase().includes(t));
  }, [items, q]);

  if (loading) return <div className="p-4">Loading…</div>;
  return (
    <div className="p-6 bg-[var(--hp-bg)] min-h-screen">
      {/* Top actions */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Forms</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[var(--hp-text-muted)]"></i>
            <input
              className="hp-input h-9 pl-9 pr-3 rounded-xl text-sm"
              placeholder="Search forms…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="hp-button-primary h-9 px-4 rounded-xl text-sm font-medium" onClick={handleCreate}>
            <i className="fa-solid fa-plus mr-2"></i>
            New Form
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((f) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
            whileHover={{ y: -2, transition: { duration: 0.15 } }}
            className="hp-card rounded-2xl p-4 cursor-pointer group"
            onClick={() => navigate(`/forms/${f.id}`)}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold truncate max-w-[16rem]">{f.title || 'Untitled Form'}</div>
                <div className="text-xs text-[var(--hp-text-muted)] mt-1 truncate">/{f.slug}</div>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium ${f.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {f.is_public ? 'Public' : 'Draft'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="h-8 px-3 rounded-lg text-sm bg-[var(--hp-surface-2)] hover:bg-slate-100"
                onClick={(e) => { e.stopPropagation(); navigate(`/forms/${f.id}`); }}
                title="Edit"
              >
                <i className="fa-solid fa-pen mr-2"></i>Edit
              </button>
              <button
                className="h-8 px-3 rounded-lg text-sm bg-[var(--hp-surface-2)] hover:bg-slate-100"
                onClick={(e) => { e.stopPropagation(); navigate(`/forms/${f.id}/responses`); }}
                title="Responses"
              >
                <i className="fa-solid fa-inbox mr-2"></i>Responses
              </button>
              <a
                className="h-8 px-3 rounded-lg text-sm bg-[var(--hp-surface-2)] hover:bg-slate-100 inline-flex items-center"
                href={`/f/${f.slug}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Open public"
              >
                <i className="fa-solid fa-up-right-from-square mr-2"></i>Open
              </a>
            </div>
          </motion.div>
        ))}
        {!filtered.length && (
          <div className="text-sm text-[var(--hp-text-muted)] p-6">No forms found. Try a different search.</div>
        )}
      </div>
    </div>
  );
}


