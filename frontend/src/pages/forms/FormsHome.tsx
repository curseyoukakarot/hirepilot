import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listForms } from '../../lib/api/forms';
import { supabase } from '../../lib/supabaseClient';

export default function FormsHome() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>('');
  const apiBase = (import.meta as any)?.env?.VITE_BACKEND_URL || '';
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Parent listener to support iframe postMessage navigation requests
    const onMsg = (e: MessageEvent) => {
      try {
        const data = e.data || {};
        if (data && data.type === 'hp_nav' && typeof data.path === 'string') {
          window.location.href = data.path;
        }
        if (data && data.type === 'hp_forms_action') {
          const action = data.action;
          if (action === 'edit' && data.id) {
            window.location.href = `/forms/${data.id}`;
          } else if (action === 'responses' && data.id) {
            window.location.href = `/forms/${data.id}/responses`;
          } else if (action === 'copy' && data.slug) {
            const url = window.location.origin + '/f/' + data.slug;
            try { navigator.clipboard.writeText(url); } catch {}
          } else if (action === 'create') {
            (async () => {
              try {
                const resp = await fetch(apiBase + '/api/forms', {
                  method: 'POST',
                  headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ title: 'Untitled Form', is_public: false }),
                });
                if (resp.ok) {
                  const f = await resp.json();
                  window.location.href = `/forms/${f?.id || ''}`;
                }
              } catch {}
            })();
          } else if (action === 'delete' && data.id) {
            (async () => {
              try {
                const resp = await fetch(apiBase + '/api/forms/' + data.id, {
                  method: 'DELETE',
                  headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                  credentials: 'include',
                });
                if (resp.ok) {
                  setItems(prev => prev.filter(x => x.id !== data.id));
                }
              } catch {}
            })();
          }
        }
      } catch {}
    };
    window.addEventListener('message', onMsg);
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [{ data: { session } }, dataResp] = await Promise.all([
          supabase.auth.getSession(),
          listForms().catch(() => ({ items: [] })),
        ] as const);
        if (!mounted) return;
        setToken(session?.access_token || '');
        setItems(Array.isArray((dataResp as any)?.items) ? (dataResp as any).items : []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; window.removeEventListener('message', onMsg); };
  }, []);

  const html = useMemo(() => {
    const esc = (s: any) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const timeAgo = (iso?: string) => {
      try {
        const d = new Date(iso || '');
        const diff = Math.max(0, Date.now() - d.getTime());
        const h = Math.floor(diff / 3600000);
        if (h < 24) return `${h || 1}h ago`;
        const dys = Math.floor(h / 24);
        return `${dys}d ago`;
      } catch { return '—'; }
    };
    const count = items.length;
    const cards = items.map((f, idx) => {
      const stagger = `stagger-${(idx % 6) + 1}`;
      const statusPill = f.is_public
        ? '<span class="px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-medium">Published</span>'
        : '<span class="px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400 text-xs font-medium">Draft</span>';
      const title = esc(f.title || 'Untitled Form');
      const desc = esc(f.description || '');
      const updated = timeAgo(f.updated_at);
      const updatedTs = Number(new Date(f.updated_at || f.created_at || Date.now()).getTime() || 0);
      const slug = esc(f.slug);
      const id = esc(f.id);
      return `
        <div class="rounded-2xl border border-white/5 bg-hp-surface/80 backdrop-blur p-6 card-hover cursor-pointer opacity-0 animate-fade-in ${stagger}" data-id="${id}" data-status="${f.is_public ? 'published' : 'draft'}" data-title="${title.toLowerCase()}" data-updated="${updatedTs}">
          <div class="flex items-start justify-between mb-3">
            <h3 class="text-xl font-semibold text-white line-clamp-1 flex-1">${title}</h3>
            <div class="relative">
              <button class="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center transition-all js-menu-toggle" aria-haspopup="menu" aria-expanded="false">
                <i class="fa-solid fa-ellipsis-vertical text-hp-text-muted"></i>
              </button>
              <div class="dropdown-menu" role="menu">
                <a class="dropdown-item" data-action="edit" data-id="${id}">
                  <span class="icon"><i class="fa-solid fa-pen"></i></span>
                  <span class="label">Edit Form</span>
                </a>
                <a class="dropdown-item" data-action="share" data-slug="${slug}">
                  <span class="icon"><i class="fa-solid fa-share-nodes"></i></span>
                  <span class="label">Share Form</span>
                </a>
                <a class="dropdown-item" data-action="copy" data-slug="${slug}">
                  <span class="icon"><i class="fa-solid fa-link"></i></span>
                  <span class="label">Copy Link</span>
                </a>
                <a class="dropdown-item" data-action="responses" data-id="${id}">
                  <span class="icon"><i class="fa-solid fa-chart-simple"></i></span>
                  <span class="label">View Responses</span>
                </a>
                <div class="dropdown-sep"></div>
                <a class="dropdown-item danger" data-action="delete" data-id="${id}">
                  <span class="icon"><i class="fa-solid fa-trash"></i></span>
                  <span class="label">Delete</span>
                </a>
              </div>
            </div>
          </div>
          <p class="text-sm text-hp-text-muted line-clamp-2 mb-4">${desc || '—'}</p>
          <div class="flex justify-between items-center text-xs text-hp-text-muted pt-3 border-t border-white/5">
            <div class="flex items-center gap-4">
              <span class="flex items-center gap-1.5">
                <i class="fa-solid fa-file-lines"></i>
                — submissions
              </span>
              <span class="flex items-center gap-1.5">
                <i class="fa-solid fa-clock"></i>
                Updated ${updated}
              </span>
            </div>
            ${statusPill}
          </div>
        </div>
      `;
    }).join('\n');

    return `<!DOCTYPE html>

<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forms</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>window.FontAwesomeConfig = { autoReplaceSvg: 'nest'};</script>
    <script>
      try {
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                'hp-bg': '#0a0a0f',
                'hp-surface': '#13131a',
                'hp-border': '#1f1f28',
                'hp-primary': '#5b8cff',
                'hp-primary-2': '#4a7ae8',
                'hp-text-muted': '#9ca3af',
                'hp-success': '#10b981'
              }
            }
          }
        };
      } catch (e) {}
    </script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        ::-webkit-scrollbar { display: none; }
        * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        body { margin: 0; padding: 0; }
        .card-hover { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .card-hover:hover { 
            transform: translateY(-1px);
            box-shadow: 0 0 0 1px rgba(91, 140, 255, 0.2), 0 20px 25px -5px rgba(0, 0, 0, 0.3);
        }
        .dropdown-menu { 
            display: none; position: absolute; right: 0; top: 100%; margin-top: 0.5rem; 
            background: rgba(19, 19, 26, 0.95); backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 0.75rem; 
            padding: 0.4rem; min-width: 220px; z-index: 50; 
            box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255,255,255,0.04) inset;
        }
        .dropdown-menu.active { display: block; }
        .dropdown-item { 
            display: flex; align-items: center; gap: 0.625rem; 
            padding: 0.55rem 0.7rem; border-radius: 0.6rem; 
            cursor: pointer; transition: background 0.15s, color 0.15s, transform 0.1s;
            color: #e5e7eb; font-size: 0.9rem; line-height: 1.2;
        }
        .dropdown-item .icon { width: 1rem; display: inline-flex; justify-content: center; color: #9ca3af; }
        .dropdown-item:hover { background: rgba(255, 255, 255, 0.06); color: #ffffff; }
        .dropdown-item:hover .icon { color: #ffffff; }
        .dropdown-item.danger { color: #fca5a5; }
        .dropdown-item.danger:hover { background: rgba(239, 68, 68, 0.12); color: #fecaca; }
        .dropdown-sep { height: 1px; background: rgba(255,255,255,0.06); margin: 0.35rem 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .stagger-1 { animation-delay: 0.05s; }
        .stagger-2 { animation-delay: 0.1s; }
        .stagger-3 { animation-delay: 0.15s; }
        .stagger-4 { animation-delay: 0.2s; }
        .stagger-5 { animation-delay: 0.25s; }
        .stagger-6 { animation-delay: 0.3s; }
    </style>
</head>
<body class="bg-hp-bg text-white">
    <header id="header" class="sticky top-0 z-40 flex justify-between items-center px-8 py-6 border-b border-white/5 bg-hp-bg/80 backdrop-blur supports-[backdrop-filter]:bg-hp-bg/50">
        <div class="flex items-center gap-3">
            <h1 class="text-2xl font-semibold">Forms</h1>
            <span class="px-2.5 py-1 rounded-lg bg-white/5 text-hp-text-muted text-sm font-medium">(${count})</span>
        </div>
        <button id="js-new-form" class="bg-hp-primary hover:bg-hp-primary-2 text-white px-4 h-11 rounded-xl font-medium flex items-center gap-2 shadow-sm transition-all">
            <i class="fa-solid fa-plus"></i>
            New Form
        </button>
    </header>
    <div id="search-filters" class="px-8 py-4 flex items-center justify-between border-b border-white/5">
        <div class="relative">
            <i class="fa-solid fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-hp-text-muted text-sm"></i>
            <input type="text" placeholder="Search forms…" class="w-[300px] h-11 pl-10 pr-4 bg-hp-surface border border-hp-border rounded-xl text-sm placeholder:text-hp-text-muted focus:outline-none focus:border-hp-primary/50 focus:ring-4 focus:ring-hp-primary/10 transition-all">
        </div>
        <div class="flex items-center gap-3">
            <div class="relative" id="sort-menu">
                <button class="h-11 px-4 bg-hp-surface border border-hp-border rounded-xl text-sm font-medium hover:border-white/10 transition-all flex items-center gap-2 js-sort-toggle">
                    <span id="sort-label">Sort by: Updated Recently</span>
                    <i class="fa-solid fa-chevron-down text-xs text-hp-text-muted"></i>
                </button>
                <div class="dropdown-menu">
                  <div class="dropdown-item" data-action="sort" data-mode="updated_desc">Updated Recently</div>
                  <div class="dropdown-item" data-action="sort" data-mode="title_asc">Title A–Z</div>
                  <div class="dropdown-item" data-action="sort" data-mode="title_desc">Title Z–A</div>
                </div>
            </div>
            <div class="relative" id="filter-menu">
                <button class="h-11 px-4 bg-hp-surface border border-hp-border rounded-xl text-sm font-medium hover:border-white/10 transition-all flex items-center gap-2 js-filter-toggle">
                    <span id="filter-label">Filter: All Forms</span>
                    <i class="fa-solid fa-chevron-down text-xs text-hp-text-muted"></i>
                </button>
                <div class="dropdown-menu">
                  <div class="dropdown-item" data-action="filter" data-mode="all">All Forms</div>
                  <div class="dropdown-item" data-action="filter" data-mode="published">Published</div>
                  <div class="dropdown-item" data-action="filter" data-mode="draft">Drafts</div>
                </div>
            </div>
        </div>
    </div>
    <main id="forms-grid" class="px-8 py-8">
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          ${cards || '<div class="text-sm text-hp-text-muted">No forms yet.</div>'}
        </div>
    </main>
    <!-- No inline scripts; interactions are delegated from parent via onLoad -->
</body>
</html>`;
    return html;
  }, [items, token, apiBase]);

  // Attach delegated event handlers inside the iframe after it loads
  function attachIframeHandlers() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    // Toggle menus
    function closeAll() {
      doc.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('active'));
      doc.querySelectorAll('.js-menu-toggle').forEach(b => b.setAttribute('aria-expanded', 'false'));
    }
    doc.addEventListener('click', (e: any) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      // open/close menu
      const toggleBtn = target.closest('.js-menu-toggle') as HTMLElement | null;
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const menu = toggleBtn.nextElementSibling as HTMLElement | null;
        if (!menu) return;
        const isActive = menu.classList.contains('active');
        closeAll();
        if (!isActive) {
          menu.classList.add('active');
          toggleBtn.setAttribute('aria-expanded', 'true');
        }
        return;
      }
      // click outside to close
      if (!target.closest('.relative')) {
        closeAll();
      }
      // action items
      const actionItem = target.closest('[data-action]') as HTMLElement | null;
      if (actionItem) {
        const action = actionItem.getAttribute('data-action') || '';
        const id = actionItem.getAttribute('data-id') || '';
        const slug = actionItem.getAttribute('data-slug') || '';
        if (action === 'edit') {
          window.location.href = `/forms/${id}`;
        } else if (action === 'responses') {
          window.location.href = `/forms/${id}/responses`;
        } else if (action === 'copy' || action === 'share') {
          const url = window.location.origin + '/f/' + slug;
          try { navigator.clipboard.writeText(url); } catch {}
          closeAll();
        } else if (action === 'delete') {
          // Notify parent to perform deletion (auth in parent)
          window.postMessage({ type: 'hp_forms_action', action: 'delete', id }, '*');
        } else if (action === 'sort') {
          const mode = actionItem.getAttribute('data-mode') || 'updated_desc';
          const label = doc.getElementById('sort-label'); if (label) label.textContent = 'Sort by: ' + (mode==='updated_desc'?'Updated Recently': mode==='title_asc'?'Title A–Z':'Title Z–A');
          const grid = doc.querySelector('#forms-grid .grid'); if (!grid) return;
          const cards = Array.from(grid.children) as HTMLElement[];
          const sorted = cards.sort((a,b) => {
            if (mode==='updated_desc') return Number(b.getAttribute('data-updated')||'0') - Number(a.getAttribute('data-updated')||'0');
            if (mode==='title_asc') return String(a.getAttribute('data-title')||'').localeCompare(String(b.getAttribute('data-title')||''));
            if (mode==='title_desc') return String(b.getAttribute('data-title')||'').localeCompare(String(a.getAttribute('data-title')||''));
            return 0;
          });
          sorted.forEach(el => grid.appendChild(el));
          closeAll();
        } else if (action === 'filter') {
          const mode = actionItem.getAttribute('data-mode') || 'all';
          const label = doc.getElementById('filter-label'); if (label) label.textContent = 'Filter: ' + (mode==='all'?'All Forms': mode==='published'?'Published':'Drafts');
          doc.querySelectorAll('[data-id]').forEach((el: any) => {
            const status = el.getAttribute('data-status') || 'draft';
            el.style.display = (mode==='all' || status===mode) ? '' : 'none';
          });
          closeAll();
        }
      }
      // New form button
      const newBtn = target.closest('#js-new-form') as HTMLElement | null;
      if (newBtn) {
        e.preventDefault();
        window.postMessage({ type: 'hp_forms_action', action: 'create' }, '*');
      }
    });
  }

  if (loading) {
    return <div className="p-4">Loading…</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <iframe
        ref={iframeRef}
        title="Forms"
        srcDoc={html as any}
        onLoad={attachIframeHandlers}
        style={{ width: '100%', height: 'calc(100vh - 0px)', border: '0', background: 'transparent' }}
      />
    </div>
  );
}
