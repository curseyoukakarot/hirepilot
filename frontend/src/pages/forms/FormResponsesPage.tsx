import React, { MouseEvent, useEffect, useMemo, useState } from 'react';
import { getForm, listResponses } from '../../lib/api/forms';

export default function FormResponsesPage() {
  // Keep extracting form id for consistency with existing routing, even if unused here
  const formId = useMemo(() => {
    const parts = window.location.pathname.split('/');
    return parts[parts.length - 2] || '';
  }, []);

  const [isDark, setIsDark] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [values, setValues] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [fieldsById, setFieldsById] = useState<Record<string, { label: string; type?: string }>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize theme based on localStorage or system preference
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const current = saved ? saved : prefersDark ? 'dark' : 'light';
    if (current === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  function toggleTheme() {
    const html = document.documentElement;
    html.classList.toggle('dark');
    const nowDark = html.classList.contains('dark');
    setIsDark(nowDark);
    localStorage.setItem('theme', nowDark ? 'dark' : 'light');
  }

  function onRowClick(responseId: string, e: MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest('input[type="checkbox"]')) return;
    setSelectedId(responseId);
  }

  // Load form fields and responses
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [form, resp] = await Promise.all([
          getForm(formId),
          listResponses(formId, { page }),
        ]);
        if (!mounted) return;
        const mapping: Record<string, { label: string; type?: string }> = {};
        for (const f of (form?.fields || [])) {
          mapping[f.id] = { label: f.label, type: f.type };
        }
        setFieldsById(mapping);
        setItems(resp.items || []);
        setValues(resp.values || []);
        setTotal(resp.total || 0);
        setPageSize(resp.pageSize || 20);
        if (!selectedId && (resp.items || []).length) {
          setSelectedId(resp.items[0].id);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, page]);

  // Helpers to extract display values from response values
  const valuesByResponse: Record<string, any[]> = (() => {
    const map: Record<string, any[]> = {};
    for (const v of values || []) {
      const key = v.response_id;
      if (!map[key]) map[key] = [];
      map[key].push(v);
    }
    return map;
  })();

  function pickValue(
    responseId: string,
    matcher: (fieldMeta: { label: string; type?: string }) => boolean
  ): string | null {
    const arr = valuesByResponse[responseId] || [];
    for (const v of arr) {
      const meta = fieldsById[v.field_id];
      if (meta && matcher(meta)) {
        const raw = v.value ?? v.file_url ?? (v.json_value ? JSON.stringify(v.json_value) : null);
        if (raw) return String(raw);
      }
    }
    return null;
  }

  const getName = (id: string) =>
    pickValue(id, (m) => /name/i.test(m.label)) ||
    pickValue(id, (m) => m.type === 'short_text') ||
    '';
  const getEmail = (id: string) =>
    pickValue(id, (m) => m.type === 'email' || /email/i.test(m.label)) || '';
  const getBreakIntoTech = (id: string) =>
    pickValue(id, (m) => /break.*into.*tech/i.test(m.label)) || '';
  const getRoleType = (id: string) =>
    pickValue(id, (m) => /(role|position).*type/i.test(m.label) || /role type/i.test(m.label)) || '';
  const getExperience = (id: string) =>
    pickValue(id, (m) => /experience|years/i.test(m.label)) || '';

  function formatDate(s: string) {
    const d = new Date(s);
    return d.toLocaleDateString();
  }
  function formatTime(s: string) {
    const d = new Date(s);
    return d.toLocaleTimeString();
  }
  function isNew(submittedAt: string) {
    const diff = Date.now() - new Date(submittedAt).getTime();
    return diff < 24 * 60 * 60 * 1000; // 24h
  }

  return (
    <div id="app" className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-200">
      <header className="sticky top-0 z-50 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Responses</h1>
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium px-2.5 py-0.5 rounded-full">
                {total} total
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="text"
                  placeholder="Search responses..."
                  className="pl-10 pr-4 py-2 w-64 bg-gray-100 dark:bg-dark-bg border-0 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-dark-card transition-all"
                />
              </div>
              <button className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors">
                <i className="fas fa-filter text-sm" />
                <span className="text-sm font-medium">Filter</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-2 bg-primary text-white hover:bg-blue-700 rounded-lg transition-colors">
                <i className="fas fa-download text-sm" />
                <span className="text-sm font-medium">Export</span>
              </button>
              <button
                id="theme-toggle"
                onClick={toggleTheme}
                className="p-2 bg-gray-100 dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
                aria-label="Toggle theme"
              >
                <i className={`fas fa-sun ${isDark ? 'hidden' : ''} text-yellow-500`} />
                <i className={`fas fa-moon ${isDark ? '' : 'hidden'} text-blue-400`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div
          id="responses-table"
          className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input type="checkbox" className="rounded border-gray-300 dark:border-dark-border" />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-dark-secondary uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-dark-secondary uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-dark-secondary uppercase tracking-wider">
                    Values
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-dark-secondary uppercase tracking-wider">
                    Break into tech
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-dark-secondary uppercase tracking-wider">
                    Role Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-dark-secondary uppercase tracking-wider">
                    Experience
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-dark-secondary">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-dark-secondary">
                      No responses yet.
                    </td>
                  </tr>
                ) : (
                  items.map((r) => {
                    const selected = r.id === selectedId;
                    const date = formatDate(r.submitted_at);
                    const time = formatTime(r.submitted_at);
                    const source = r.source || 'direct';
                    const name = getName(r.id);
                    const email = getEmail(r.id);
                    const br = getBreakIntoTech(r.id);
                    const role = getRoleType(r.id);
                    const exp = getExperience(r.id);
                    return (
                      <tr
                        key={r.id}
                        className={
                          'row-hover hover:bg-gray-50 dark:hover:bg-dark-bg cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ' +
                          (selected ? 'border-l-4 border-primary bg-blue-50 dark:bg-blue-900/10' : '')
                        }
                        onClick={(e) => onRowClick(r.id, e)}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-dark-border"
                            checked={selected}
                            onChange={() => setSelectedId(r.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-dark-text font-medium">{date}</div>
                          <div className="text-sm text-gray-500 dark:text-dark-secondary">{time}</div>
                          {isNew(r.submitted_at) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 ml-2">
                              New
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                            {source}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-dark-text">{name || '-'}</div>
                          <div className="text-sm text-gray-500 dark:text-dark-secondary">{email || '-'}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-dark-text">{br || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-dark-text">{role || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-dark-text">{exp || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-gray-50 dark:bg-dark-bg border-t border-gray-200 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-dark-secondary">
                {(() => {
                  const start = (page - 1) * pageSize + 1;
                  const end = (page - 1) * pageSize + items.length;
                  return `Showing ${items.length ? start : 0}-${items.length ? end : 0} of ${total} responses`;
                })()}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text disabled:opacity-50"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <i className="fas fa-chevron-left" />
                </button>
                <button className="px-3 py-1 bg-primary text-white rounded">{page}</button>
                <button
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text disabled:opacity-50"
                  aria-label="Next page"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <i className="fas fa-chevron-right" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


