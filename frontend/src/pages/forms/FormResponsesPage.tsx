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
  const [fieldsById, setFieldsById] = useState<Record<string, { label: string; type?: string; position?: number }>>({});
  const [formFields, setFormFields] = useState<Array<{ id: string; label: string; type?: string; position?: number }>>([]);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
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
    setDrawerOpen(true);
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
        const mapping: Record<string, { label: string; type?: string; position?: number }> = {};
        const fieldsArr =
          (form?.fields || []).map((f: any) => ({
            id: f.id,
            label: f.label,
            type: f.type,
            position: typeof f.position === 'number' ? f.position : 0,
          })) || [];
        fieldsArr.forEach((f: any) => {
          mapping[f.id] = { label: f.label, type: f.type, position: f.position };
        });
        setFieldsById(mapping);
        setFormFields(fieldsArr);
        setItems(resp.items || []);
        setValues(resp.values || []);
        setTotal(resp.total || 0);
        setPageSize(resp.pageSize || 20);
        if (!selectedId && (resp.items || []).length) {
          setSelectedId(resp.items[0].id);
        }
        // open drawer when selection exists
        if (!selectedId && (resp.items || []).length) {
          setDrawerOpen(true);
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

  function initialsFromName(name?: string) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '??';
  }

  const selectedResponse = selectedId ? items.find((it) => it.id === selectedId) : null;
  const selectedValues = selectedId ? (valuesByResponse[selectedId] || []) : [];

  function closeDrawer() {
    setDrawerOpen(false);
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
              <button className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-[#1a1d22] hover:bg-gray-200 dark:hover:bg-[#23262b] rounded-lg transition-colors">
                <i className="fas fa-filter text-sm" />
                <span className="text-sm font-medium">Filter</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-2 bg-primary text-white hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors">
                <i className="fas fa-download text-sm" />
                <span className="text-sm font-medium">Export</span>
              </button>
              <button
                id="theme-toggle"
                onClick={toggleTheme}
                className="p-2 bg-gray-100 dark:bg-[#1a1d22] hover:bg-gray-200 dark:hover:bg-[#23262b] rounded-lg transition-colors"
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
          className="bg-white dark:bg-[#14161a] rounded-xl border border-gray-200 dark:border-[#2a2d33] overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#0f1114] border-b border-gray-200 dark:border-[#2a2d33]">
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
                          'group cursor-pointer transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-[#1c1f24] ' +
                          (selected ? 'border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30' : '')
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
          <div className="px-6 py-4 bg-gray-50 dark:bg-[#0f1114] border-t border-gray-200 dark:border-[#2a2d33]">
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
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 dark:bg-black/60 backdrop transition-opacity duration-300 z-40 ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Right Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-dark-card shadow-2xl border-l border-gray-200 dark:border-dark-border z-50 transform transition-transform duration-300 ease-out rounded-l-xl overflow-hidden ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Response details"
      >
        {/* Drawer Header */}
        <div className="sticky top-0 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <button
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border text-gray-500 dark:text-dark-secondary transition-colors"
              onClick={closeDrawer}
              aria-label="Close drawer"
            >
              <i className="fas fa-arrow-left" />
            </button>
            <div className="relative">
              <button
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border text-gray-500 dark:text-dark-secondary transition-colors"
                aria-label="More actions"
              >
                <i className="fas fa-ellipsis-v" />
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
              {initialsFromName(getName(selectedId || ''))}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-dark-text">
                {getName(selectedId || '') || 'Submission'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-dark-secondary">
                {selectedResponse && (
                  <>
                    <span>
                      Submitted {formatDate(selectedResponse.submitted_at)} at {formatTime(selectedResponse.submitted_at)}
                    </span>
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full">
                      {selectedResponse.source || 'direct'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="space-y-6">
            {formFields
              .filter((f) => selectedValues.some((v: any) => v.field_id === f.id && (v.value || v.file_url || v.json_value)))
              .sort((a, b) => (a.position || 0) - (b.position || 0))
              .map((field) => {
                const vals = selectedValues.filter((v: any) => v.field_id === field.id);
                const display = vals.map((v: any) => {
                  if (v.file_url) {
                    return { type: 'file', value: v.file_url };
                  }
                  if (field.type === 'multi_select' && v.json_value && Array.isArray(v.json_value)) {
                    return { type: 'text', value: (v.json_value as any[]).join(', ') };
                  }
                  if (field.type === 'long_text') {
                    return { type: 'long-text', value: v.value || '' };
                  }
                  if (field.type === 'email') {
                    return { type: 'email', value: v.value || '' };
                  }
                  if (field.type === 'phone') {
                    return { type: 'phone', value: v.value || '' };
                  }
                  if ((field.type === 'short_text' || field.type === 'dropdown') && typeof v.value === 'string') {
                    if (v.value.startsWith('http://') || v.value.startsWith('https://')) return { type: 'link', value: v.value };
                  }
                  const str =
                    v.value ??
                    (v.json_value ? JSON.stringify(v.json_value) : '') ??
                    '';
                  return { type: 'text', value: String(str) };
                });

                return (
                  <div key={field.id} className="field-item">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-900 dark:text-dark-text">{field.label}</label>
                      <div className="space-y-2">
                        {display.map((d, i) => {
                          if (!d.value) return null;
                          if (d.type === 'email') {
                            return (
                              <a
                                key={i}
                                href={`mailto:${d.value}`}
                                className="inline-flex items-center px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                              >
                                <i className="fas fa-envelope mr-2" />
                                {d.value}
                              </a>
                            );
                          }
                          if (d.type === 'phone') {
                            return (
                              <a
                                key={i}
                                href={`tel:${d.value}`}
                                className="inline-flex items-center px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                              >
                                <i className="fas fa-phone mr-2" />
                                {d.value}
                              </a>
                            );
                          }
                          if (d.type === 'link') {
                            return (
                              <a
                                key={i}
                                href={String(d.value)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline break-all inline-flex items-center"
                              >
                                <i className="fas fa-external-link-alt mr-2" />
                                {String(d.value)}
                              </a>
                            );
                          }
                          if (d.type === 'file') {
                            return (
                              <a
                                key={i}
                                href={String(d.value)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center px-3 py-2 bg-gray-50 dark:bg-dark-bg text-gray-700 dark:text-dark-text rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
                              >
                                <i className="fas fa-paperclip mr-2" />
                                Attachment
                              </a>
                            );
                          }
                          if (d.type === 'long-text') {
                            const text = String(d.value);
                            return (
                              <div key={i} className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg">
                                <p className="text-gray-700 dark:text-dark-text whitespace-pre-wrap">
                                  {text}
                                </p>
                              </div>
                            );
                          }
                          return (
                            <p key={i} className="text-gray-700 dark:text-dark-text break-words">
                              {String(d.value)}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-dark-card border-t border-gray-200 dark:border-dark-border px-6 py-4">
          <div className="flex flex-wrap gap-3 mb-4">
            <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              <i className="fas fa-reply mr-2" />
              Reply to Candidate
            </button>
            <button className="px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors">
              Add to Pool
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex px-3 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full cursor-pointer">
              Strong Fit
            </span>
            <span className="inline-flex px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 rounded-full cursor-pointer">
              Follow Up
            </span>
            <span className="inline-flex px-3 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded-full cursor-pointer">
              Reject
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}


