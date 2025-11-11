import React, { useEffect, useMemo, useState } from 'react';
import { listForms } from '../../lib/api/forms';
import { supabase } from '../../lib/supabaseClient';

export default function FormsHome() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>('');
  const apiBase = (import.meta as any)?.env?.VITE_BACKEND_URL || '';

  useEffect(() => {
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
    return () => { mounted = false; };
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
              <button class="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center transition-all" onclick="window.__HP_FORMS__.toggleDropdown(event)">
                <i class="fa-solid fa-ellipsis-vertical text-hp-text-muted"></i>
              </button>
              <div class="dropdown-menu">
                <div class="dropdown-item" onclick="window.__HP_FORMS__.edit('${id}')"><i class="fa-solid fa-pen mr-2"></i>Edit Form</div>
                <div class="dropdown-item" onclick="window.__HP_FORMS__.share('${slug}')"><i class="fa-solid fa-share-nodes mr-2"></i>Share Form</div>
                <div class="dropdown-item" onclick="window.__HP_FORMS__.copy('${slug}')"><i class="fa-solid fa-link mr-2"></i>Copy Link</div>
                <div class="dropdown-item" onclick="window.__HP_FORMS__.responses('${id}')"><i class="fa-solid fa-chart-simple mr-2"></i>View Responses</div>
                <div class="border-t border-white/5 my-1"></div>
                <div class="dropdown-item danger" onclick="window.__HP_FORMS__.remove('${id}', this)"><i class="fa-solid fa-trash mr-2"></i>Delete</div>
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
    <script>
        window.FontAwesomeConfig = { autoReplaceSvg: 'nest'};
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
        }
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
        .dropdown-menu { display: none; position: absolute; right: 0; top: 100%; margin-top: 0.5rem; background: #13131a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.75rem; padding: 0.5rem; min-width: 180px; z-index: 50; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); }
        .dropdown-menu.active { display: block; }
        .dropdown-item { padding: 0.625rem 0.875rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.15s; color: #e5e7eb; font-size: 0.875rem; }
        .dropdown-item:hover { background: rgba(91, 140, 255, 0.1); color: #5b8cff; }
        .dropdown-item.danger:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
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
        <button class="bg-hp-primary hover:bg-hp-primary-2 text-white px-4 h-11 rounded-xl font-medium flex items-center gap-2 shadow-sm transition-all" onclick="window.__HP_FORMS__.create()">
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
                <button class="h-11 px-4 bg-hp-surface border border-hp-border rounded-xl text-sm font-medium hover:border-white/10 transition-all flex items-center gap-2" onclick="window.__HP_FORMS__.toggleSort(event)">
                    <span id="sort-label">Sort by: Updated Recently</span>
                    <i class="fa-solid fa-chevron-down text-xs text-hp-text-muted"></i>
                </button>
                <div class="dropdown-menu">
                  <div class="dropdown-item" onclick="window.__HP_FORMS__.applySort('updated_desc')">Updated Recently</div>
                  <div class="dropdown-item" onclick="window.__HP_FORMS__.applySort('title_asc')">Title A–Z</div>
                  <div class="dropdown-item" onclick="window.__HP_FORMS__.applySort('title_desc')">Title Z–A</div>
                </div>
            </div>
            <div class="relative" id="filter-menu">
                <button class="h-11 px-4 bg-hp-surface border border-hp-border rounded-xl text-sm font-medium hover:border-white/10 transition-all flex items-center gap-2" onclick="window.__HP_FORMS__.toggleFilter(event)">
                    <span id="filter-label">Filter: All Forms</span>
                    <i class="fa-solid fa-chevron-down text-xs text-hp-text-muted"></i>
                </button>
                <div class="dropdown-menu">
                  <div class="dropdown-item" onclick="window.__HP_FORMS__.applyFilter('all')">All Forms</div>
                  <div class="dropdown-item" onclick="window.__HP_FORMS__.applyFilter('published')">Published</div>
                  <div class="dropdown-item" onclick="window.__HP_FORMS__.applyFilter('draft')">Drafts</div>
                </div>
            </div>
        </div>
    </div>
    <main id="forms-grid" class="px-8 py-8">
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          ${cards || '<div class="text-sm text-hp-text-muted">No forms yet.</div>'}
        </div>
    </main>
    <script>
        function toggleDropdown(event) {
            event.stopPropagation();
            const button = event.currentTarget;
            const dropdown = button.nextElementSibling;
            const allDropdowns = document.querySelectorAll('.dropdown-menu');
            allDropdowns.forEach(d => { if (d !== dropdown) d.classList.remove('active'); });
            dropdown.classList.toggle('active');
        }
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.relative')) {
                document.querySelectorAll('.dropdown-menu').forEach(d => { d.classList.remove('active'); });
            }
        });
        window.__HP_FORMS__ = {
          API_BASE: ${JSON.stringify(apiBase)},
          TOKEN: ${JSON.stringify(token)},
          edit: function(id){ window.top.location.href = '/forms/' + id; },
          responses: function(id){ window.top.location.href = '/forms/' + id + '/responses'; },
          copy: function(slug){ const url = window.location.origin + '/f/' + slug; try { navigator.clipboard.writeText(url); } catch {} },
          share: function(slug){ this.copy(slug); },
          remove: async function(id, el){ try { const resp = await fetch(this.API_BASE + '/api/forms/' + id, { method:'DELETE', headers: { 'Authorization': 'Bearer ' + this.TOKEN, 'Content-Type':'application/json' }, credentials:'include' }); if (resp.ok) { const card = el && el.closest('[data-id]'); if (card) card.remove(); const headerCount = document.querySelector('#header span'); try { const n = document.querySelectorAll('[data-id]').length; headerCount && (headerCount.textContent = '(' + n + ')'); } catch {} } } catch {} },
          create: async function(){ try { const resp = await fetch(this.API_BASE + '/api/forms', { method:'POST', headers: { 'Authorization':'Bearer ' + this.TOKEN, 'Content-Type':'application/json' }, credentials:'include', body: JSON.stringify({ title: 'Untitled Form', is_public: false }) }); if (resp.ok) { const f = await resp.json(); window.top.location.href = '/forms/' + (f?.id || ''); } } catch {} },
          toggleDropdown,
          toggleSort: function(e){ e.stopPropagation(); const m = document.querySelector('#sort-menu .dropdown-menu'); if (m) m.classList.toggle('active'); },
          toggleFilter: function(e){ e.stopPropagation(); const m = document.querySelector('#filter-menu .dropdown-menu'); if (m) m.classList.toggle('active'); },
          applyFilter: function(mode){ const label = document.getElementById('filter-label'); if (label) label.textContent = 'Filter: ' + (mode==='all'?'All Forms': mode==='published'?'Published':'Drafts'); document.querySelectorAll('[data-id]').forEach(el => { const status = el.getAttribute('data-status') || 'draft'; (el as any).style.display = (mode==='all' || status===mode) ? '' : 'none'; }); },
          applySort: function(mode){ const label = document.getElementById('sort-label'); if (label) label.textContent = 'Sort by: ' + (mode==='updated_desc'?'Updated Recently': mode==='title_asc'?'Title A–Z':'Title Z–A'); const grid = document.querySelector('#forms-grid .grid'); if (!grid) return; const cards = Array.from(grid.children); const sorted = cards.sort((a,b)=>{ if (mode==='updated_desc') { return Number(b.getAttribute('data-updated')||'0') - Number(a.getAttribute('data-updated')||'0'); } if (mode==='title_asc') { return String(a.getAttribute('data-title')||'').localeCompare(String(b.getAttribute('data-title')||'')); } if (mode==='title_desc') { return String(b.getAttribute('data-title')||'').localeCompare(String(a.getAttribute('data-title')||'')); } return 0; }); sorted.forEach(el => grid.appendChild(el)); }
        };
    </script>
</body>
</html>`;
    return html;
  }, [items, token, apiBase]);

  if (loading) {
    return <div className="p-4">Loading…</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <iframe
        title="Forms"
        srcDoc={html as any}
        style={{ width: '100%', height: 'calc(100vh - 0px)', border: '0', background: 'transparent' }}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
