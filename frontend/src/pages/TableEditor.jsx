import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { evaluate as mathEvaluate } from 'mathjs';
import Papa from 'papaparse';

export default function TableEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  // IMPORTANT: in production the backend lives at api.thehirepilot.com (not the Vercel app domain).
  // If VITE_BACKEND_URL isn't set, default to the canonical API host.
  const backendBase = (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || 'https://api.thehirepilot.com';
  const [tableName, setTableName] = useState('Untitled Table');
  const [lastSavedName, setLastSavedName] = useState('Untitled Table');
  const [saving, setSaving] = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);
  const [schema, setSchema] = useState([]);
  const [rows, setRows] = useState([]);
  const [accessRole, setAccessRole] = useState('edit'); // 'owner' | 'edit' | 'view'
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [showShare, setShowShare] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [collabProfiles, setCollabProfiles] = useState({}); // user_id -> { id,email,name,avatar_url,team_id,role }
  const [guestInvites, setGuestInvites] = useState([]); // [{ email, role, status }]
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [addingUserId, setAddingUserId] = useState('');
  const [addingRole, setAddingRole] = useState('view');
  const [inviteEmail, setInviteEmail] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSource, setImportSource] = useState('/leads');
  const [importFilters, setImportFilters] = useState({ status: '', startDate: '', endDate: '', limit: 1000, importAll: false });
  const [csvFile, setCsvFile] = useState(null);
  const [csvInfo, setCsvInfo] = useState({ name: '', rows: 0, cols: 0 });
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [csvReplaceExisting, setCsvReplaceExisting] = useState(false);
  const [csvError, setCsvError] = useState('');
  const [columnMenuIdx, setColumnMenuIdx] = useState(null);
  const [columnMenuPos, setColumnMenuPos] = useState(null); // { top:number, left:number }
  const [selectedColIdx, setSelectedColIdx] = useState(null); // when set, edits apply to entire column
  const [editColName, setEditColName] = useState('');
  const [editColType, setEditColType] = useState('text');
  const [selectedRowIdxSet, setSelectedRowIdxSet] = useState(new Set());
  const [editCurrency, setEditCurrency] = useState('USD');
  const [inlineEditIdx, setInlineEditIdx] = useState(null);
  const [inlineEditName, setInlineEditName] = useState('');
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [formulaColIdx, setFormulaColIdx] = useState(null);
  const [formulaExpr, setFormulaExpr] = useState('');
  const [showStatusOptionsModal, setShowStatusOptionsModal] = useState(false);
  const [statusOptionsColIdx, setStatusOptionsColIdx] = useState(null);
  const [statusOptionsDraft, setStatusOptionsDraft] = useState([]);
  const [statusOptionsInput, setStatusOptionsInput] = useState('');
  const [activeColIdx, setActiveColIdx] = useState(0);
  const [activity, setActivity] = useState([]);
  const addActivity = (msg) => setActivity((a)=>[{ msg, at: new Date() }, ...a].slice(0,50));
  const [dragColIdx, setDragColIdx] = useState(null);
  const [resizing, setResizing] = useState(null); // { idx, startX, startW }
  const menuRef = useRef(null);
  const tableNameInputRef = useRef(null);
  const commandInputRef = useRef(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { rowIdx, colIdx } | null
  const [editDraftValue, setEditDraftValue] = useState('');

  const apiFetch = async (url, init = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers = { 'Content-Type': 'application/json', ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const resp = await fetch(url, { ...init, headers, credentials: 'include' });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  };

  const isReadOnly = accessRole === 'view';

  const DEFAULT_STATUS_OPTIONS = ['Pipeline','Best Case','Commit','Close Won','Closed Lost','Open','Draft','Hired'];
  const normalizeStatusOptions = (list) => {
    const raw = Array.isArray(list) ? list : [];
    const out = [];
    const seen = new Set();
    for (const v of raw) {
      const s = String(v ?? '').trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  };

  const formatNumberForColumn = (col, nRaw) => {
    const n = Number(nRaw);
    const val = isNaN(n) ? 0 : n;
    let fmt = String(col?.format || '').toLowerCase();
    // Back-compat: older formula columns used `currency` without a `format` flag.
    if (!fmt && String(col?.type || '') === 'formula' && col?.currency) fmt = 'currency';
    if (fmt === 'percent') {
      return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(val);
    }
    if (fmt === 'decimal_0') return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    if (fmt === 'decimal_1') return new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val);
    if (fmt === 'decimal_2') return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
    if (fmt === 'currency') {
      const cur = col?.currency || 'USD';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(val);
    }
    // default "number"
    return numberFormatter.format(val);
  };

  const isEditableTarget = (el) => {
    try {
      if (!el) return false;
      const tag = String(el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.isContentEditable) return true;
      return false;
    } catch { return false; }
  };

  const getCellValue = (rowIdx, colIdx) => {
    try {
      const col = schema?.[colIdx];
      const row = rows?.[rowIdx];
      if (!col || !row) return '';
      return row?.[colKey(col)] ?? '';
    } catch { return ''; }
  };

  const startEditingCell = (rowIdx, colIdx) => {
    if (isReadOnly) return;
    if (rowIdx == null || colIdx == null) return;
    const col = schema?.[colIdx];
    if (!col) return;
    if (col?.type === 'formula') return;
    const current = getCellValue(rowIdx, colIdx);
    setEditDraftValue(current === null || current === undefined ? '' : String(current));
    setEditingCell({ rowIdx, colIdx });
  };

  const commitEditingCell = async (overrideValue) => {
    try {
      if (isReadOnly) return;
      const ec = editingCell;
      if (!ec) return;
      const col = schema?.[ec.colIdx];
      if (!col) { setEditingCell(null); return; }
      const valueToApply = overrideValue !== undefined ? overrideValue : editDraftValue;
      if (selectedColIdx !== null && selectedColIdx === ec.colIdx) {
        applyValueToColumn(ec.colIdx, valueToApply);
      } else {
        updateCell(ec.rowIdx, col, valueToApply);
      }
    } finally {
      setEditingCell(null);
    }
  };

  const cancelEditingCell = () => {
    setEditingCell(null);
    setEditDraftValue('');
  };

  const generateId = () => {
    try { return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `col_${Date.now()}_${Math.random().toString(16).slice(2)}`; } catch { return `col_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
  };
  const toKey = (label) => {
    const base = String(label || '').trim().toLowerCase()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return base || 'col';
  };
  const ensureUniqueKey = (schemaIn, desired, colIdToSkip) => {
    const taken = new Set((schemaIn || []).map(c => String(c?.key || '').toLowerCase()).filter(Boolean));
    // If updating an existing column, allow its current key.
    if (colIdToSkip) {
      const current = (schemaIn || []).find(c => String(c?.id || '') === String(colIdToSkip));
      if (current?.key) taken.delete(String(current.key).toLowerCase());
    }
    if (!taken.has(String(desired).toLowerCase())) return desired;
    let i = 2;
    while (taken.has(`${desired}_${i}`.toLowerCase())) i += 1;
    return `${desired}_${i}`;
  };
  const colLabel = (c) => String(c?.label || c?.name || '');
  const colKey = (c) => String(c?.key || toKey(colLabel(c)));
  const normalizeSchema = (schemaIn) => {
    const next = (Array.isArray(schemaIn) ? schemaIn : []).map((c) => {
      const label = String(c?.label || c?.name || 'Column');
      const id = c?.id ? String(c.id) : generateId();
      const keyBase = c?.key ? String(c.key) : toKey(label);
      const key = ensureUniqueKey(schemaIn, keyBase, id);
      // Keep `name` for backward compatibility (many parts of UI still reference it as the display label).
      return { ...c, id, key, label, name: label };
    });
    // Second pass to ensure uniqueness after normalization
    const fixed = [];
    for (const c of next) {
      const key = ensureUniqueKey(fixed, String(c.key), String(c.id));
      fixed.push({ ...c, key });
    }
    return fixed;
  };
  const migrateRowsToKeys = (rowsIn, schemaIn) => {
    const sch = Array.isArray(schemaIn) ? schemaIn : [];
    return (Array.isArray(rowsIn) ? rowsIn : []).map((r) => {
      const out = {};
      for (const c of sch) {
        const k = colKey(c);
        const label = colLabel(c);
        // Prefer key storage; fallback to legacy label/name storage.
        const v = (r && Object.prototype.hasOwnProperty.call(r, k)) ? r[k]
          : (r && Object.prototype.hasOwnProperty.call(r, label)) ? r[label]
          : (r && c?.name && Object.prototype.hasOwnProperty.call(r, c.name)) ? r[c.name]
          : undefined;
        out[k] = v;
      }
      return out;
    });
  };

  const toVarName = (name) => {
    const base = String(name || '').replace(/\W+/g, '_');
    return base.length ? base : 'col';
  };

  const buildScopeForRow = (row) => {
    const varMap = {};
    // Variables are based on display labels, but values come from stable column keys.
    (schema || []).forEach((c) => { varMap[toVarName(colLabel(c))] = colKey(c); });
    const scope = {};
    for (const v in varMap) {
      const key = varMap[v];
      const raw = row?.[key];
      const n = Number(String(raw ?? '').replace(/[^0-9.-]/g, ''));
      scope[v] = isNaN(n) ? 0 : n;
    }
    scope.SUM = (...xs) => xs.reduce((t, x) => t + (Number(x) || 0), 0);
    scope.AVG = (...xs) => {
      if (!xs.length) return 0;
      const arr = xs.map(x => Number(x) || 0);
      return arr.reduce((a,b)=>a+b,0) / arr.length;
    };
    scope.MIN = (...xs) => {
      if (!xs.length) return 0;
      const arr = xs.map(x => Number(x) || 0);
      return Math.min(...arr);
    };
    scope.MAX = (...xs) => {
      if (!xs.length) return 0;
      const arr = xs.map(x => Number(x) || 0);
      return Math.max(...arr);
    };
    scope.ROUND = (x, nd = 0) => {
      const n = Number(x) || 0;
      const d = Number(nd) || 0;
      return Number(n.toFixed(d));
    };
    return scope;
  };

  const recomputeFormulasRows = (rowsIn) => {
    const formulaCols = (schema || []).filter(c => c?.type === 'formula' && (c.formula || '').toString().trim().length > 0);
    if (!formulaCols.length) return rowsIn;
    const safeExpr = (expr) => {
      const s = String(expr || '0').trim();
      return s.startsWith('=') ? s.slice(1) : s;
    };
    return (rowsIn || []).map((r) => {
      let next = r;
      for (const c of formulaCols) {
        let result = 0;
        try {
          result = Number(mathEvaluate(safeExpr(c.formula), buildScopeForRow(next)));
          if (isNaN(result)) result = 0;
        } catch { result = 0; }
        next = { ...next, [colKey(c)]: result };
      }
      return next;
    });
  };

  const openFormulaBuilder = (colIdx) => {
    const col = schema[colIdx];
    if (!col) return;
    setFormulaColIdx(colIdx);
    setFormulaExpr(col.formula || '0');
    setShowFormulaModal(true);
  };

  const applyFormulaToColumn = async (colIdx, expression) => {
    const col = schema[colIdx]; if (!col) return;
    const nextSchema = schema.map((c, i) => i === colIdx ? { ...c, type: 'formula', formula: expression || '0' } : c);
    const recomputed = recomputeFormulasRows(rows);
    setSchema(nextSchema); setRows(recomputed);
    await persistSchemaRows(nextSchema, recomputed);
    addActivity(`Updated formula for ${col.name}`);
  };

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase
          .from('custom_tables')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (data?.name) { setTableName(String(data.name)); setLastSavedName(String(data.name)); }
        const loadedSchemaRaw = Array.isArray(data?.schema_json) ? data.schema_json : [];
        const loadedRowsRaw = Array.isArray(data?.data_json) ? data.data_json : [];
        const normalizedSchema = normalizeSchema(loadedSchemaRaw);
        const migratedRows = migrateRowsToKeys(loadedRowsRaw, normalizedSchema);
        setSchema(normalizedSchema);
        setRows(recomputeFormulasRows(migratedRows));
        setCollaborators(Array.isArray(data?.collaborators) ? data.collaborators : []);
        // Derive view/edit role for current user for better UX (RLS enforces too)
        try {
          const myId = user?.id ? String(user.id) : '';
          const ownerId = data?.user_id ? String(data.user_id) : '';
          if (myId && ownerId && myId === ownerId) setAccessRole('owner');
          else if (myId) {
            const collabs = Array.isArray(data?.collaborators) ? data.collaborators : [];
            const mine = collabs.find((c) => String(c?.user_id || '') === myId);
            setAccessRole(String(mine?.role || '').toLowerCase() === 'edit' ? 'edit' : 'view');
          }
        } catch {}
        // Best-effort: persist schema + migrated rows once (prevents future dashboard breakage on renames).
        try {
          const schemaChanged = JSON.stringify(loadedSchemaRaw) !== JSON.stringify(normalizedSchema);
          const rowsChanged = JSON.stringify(loadedRowsRaw) !== JSON.stringify(migratedRows);
          if (schemaChanged || rowsChanged) {
            await supabase
              .from('custom_tables')
              .update({ schema_json: normalizedSchema, data_json: migratedRows, updated_at: new Date().toISOString() })
              .eq('id', id);
          }
        } catch {}
      } catch {}
    };
    load();
  }, [id]);

  // Open Share modal from query param (?share=1)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('share') === '1') setShowShare(true);
    } catch {}
  }, []);

  // Determine permission and load team members list
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setCanManageAccess(false); return; }
        const { data: me } = await supabase.from('users').select('role, team_id').eq('id', user.id).maybeSingle();
        const roleLc = String(me?.role || '').toLowerCase();
        const isJobSeeker = roleLc.startsWith('job_seeker');
        const isSuper = ['super_admin','superadmin'].includes(roleLc);
        const isTeamAdmin = roleLc === 'team_admin';
        setCanManageAccess(!isJobSeeker && (isSuper || isTeamAdmin));
        if (me?.team_id) {
          const { data: members } = await supabase.from('users').select('id,email,first_name,last_name,full_name,avatar_url').eq('team_id', me.team_id);
          setTeamMembers(Array.isArray(members) ? members : []);
        } else {
          setTeamMembers([]);
        }
      } catch { setCanManageAccess(false); }
    })();
  }, []);

  const loadShareState = async () => {
    if (!id) return;
    try {
      setShareLoading(true);
      const data = await apiFetch(`${backendBase}/api/tables/${id}/collaborators-unified`);
      const collabs = Array.isArray(data?.collaborators) ? data.collaborators : [];
      // Only member collaborators are represented in custom_tables.collaborators (user_id + role)
      const members = collabs.filter((c)=>String(c?.kind||'') !== 'guest' && c?.user_id);
      const guests = collabs.filter((c)=>String(c?.kind||'') === 'guest' && c?.email);
      setGuestInvites(guests.map((g)=>({ email: String(g.email).toLowerCase(), role: (String(g.role)==='edit'?'edit':'view'), status: String(g.status||'pending') })));
      setCollaborators(members.map((c)=>({ user_id: String(c.user_id), role: (String(c.role)==='edit'?'edit':'view') })));
      const map = {};
      for (const c of members) {
        if (c?.user?.id) {
          map[String(c.user.id)] = {
            id: String(c.user.id),
            email: c.user.email || null,
            name: c.user.full_name || [c.user.first_name, c.user.last_name].filter(Boolean).join(' ') || c.user.email || c.user.id,
            avatar_url: c.user.avatar_url || null,
            team_id: c.user.team_id || null,
            role: c.user.role || null,
          };
        }
      }
      setCollabProfiles(map);
    } catch (e) {
      // If backend isn't available (dev), fall back to local state.
      console.warn('Failed to load table collaborators (unified)', e);
    } finally {
      setShareLoading(false);
    }
  };

  // Load unified collaborators when Share modal opens
  useEffect(() => {
    if (!showShare) return;
    loadShareState();
  }, [showShare, id]);

  // Realtime presence stub
  useEffect(() => {
    let channel;
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!id) return;
        channel = supabase.channel(`tables:${id}`, {
          config: { presence: { key: user?.id || 'anon' } },
        });
        channel.on('presence', { event: 'sync' }, () => {
          try {
            const state = channel.presenceState();
            const total = Object.values(state || {}).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
            if (mounted) setPresenceCount(total || 1);
          } catch {}
        });
        await channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            try { await channel.track({ joined_at: Date.now() }); } catch {}
          }
        });
      } catch {}
    })();
    return () => {
      mounted = false;
      try { if (channel) supabase.removeChannel(channel); } catch {}
    };
  }, [id]);

  const onSave = async () => {
    if (!id) return;
    if (isReadOnly) return;
    try {
      setSaving(true);
      await supabase
        .from('custom_tables')
        .update({ name: tableName, updated_at: new Date().toISOString() })
        .eq('id', id);
      setLastSavedName(tableName);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const importFrom = async (src, filters) => {
    if (isReadOnly) { window.alert('This table is view-only. Ask the owner for Edit access.'); return; }
    try {
      setSaving(true);
      // Ensure we have a real table id (handle /tables/new/edit deep-link)
      let targetId = id;
      if (!targetId || targetId === 'new') {
        // Create an empty table first (direct Supabase)
        const payload = { name: tableName || 'Untitled Table' };
        let createdId = '';
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error('Unauthenticated');
        const { data: inserted, error } = await supabase
          .from('custom_tables')
          .insert({ user_id: user.id, name: payload.name, schema_json: [], data_json: [] })
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        createdId = inserted?.id || '';
        if (!createdId) throw new Error('Failed to create table');
        targetId = createdId;
      }
      {
        // Perform import locally via Supabase (avoid Vercel APIs)
        const ensureCol = (arr, label, type) => {
          const existing = (arr || []).find(c => String(colLabel(c)) === String(label) || String(c?.name || '') === String(label));
          if (existing) return;
          const idVal = generateId();
          const key = ensureUniqueKey(arr || [], toKey(label), idVal);
          (arr || []).push({ id: idVal, key, label, name: label, type });
        };
        const { data: tableRow } = await supabase
          .from('custom_tables')
          .select('schema_json,data_json')
          .eq('id', targetId)
          .maybeSingle();
        let schemaLocal = normalizeSchema(Array.isArray(tableRow?.schema_json) ? tableRow.schema_json : []);
        let dataLocal = migrateRowsToKeys(Array.isArray(tableRow?.data_json) ? tableRow.data_json : [], schemaLocal);
        if (src === '/deals' || src === 'deals' || src === '/opportunities' || src === 'opportunities') {
          const lim = Number(filters?.limit) || 1000;
          const { data: opps } = await supabase.from('opportunities').select('title,value,stage,created_at').limit(lim);
          ensureCol(schemaLocal, 'Deal Title', 'text');
          ensureCol(schemaLocal, 'Value', 'number');
          ensureCol(schemaLocal, 'Status', 'status');
          ensureCol(schemaLocal, 'Created', 'date');
          const list = (opps || []).map(o => ({ 'Deal Title': o?.title || 'Deal', 'Value': Number(o?.value)||0, 'Status': o?.stage || 'Pipeline', 'Created': o?.created_at || null }));
          dataLocal = [...dataLocal, ...migrateRowsToKeys(list, schemaLocal)];
        } else if (src === '/jobs' || src === 'jobs') {
          const lim = Number(filters?.limit) || 1000;
          const { data: jobs } = await supabase.from('job_requisitions').select('title,status,candidate_count,created_at').limit(lim);
          ensureCol(schemaLocal, 'Position', 'text');
          ensureCol(schemaLocal, 'Candidates', 'number');
          ensureCol(schemaLocal, 'Status', 'status');
          ensureCol(schemaLocal, 'Created', 'date');
          const list = (jobs || []).map(j => ({ 'Position': j?.title || 'Job', 'Candidates': Number(j?.candidate_count)||0, 'Status': j?.status || 'Open', 'Created': j?.created_at || null }));
          dataLocal = [...dataLocal, ...migrateRowsToKeys(list, schemaLocal)];
        } else if (src === '/leads' || src === 'leads') {
          const lim = filters?.importAll ? 100000 : (Number(filters?.limit) || 2000);
          let q = supabase.from('leads').select('name,email,status,tags,location,source,created_at');
          if (filters?.status) q = q.eq('status', filters.status);
          if (filters?.startDate) q = q.gte('created_at', new Date(filters.startDate).toISOString());
          if (filters?.endDate) q = q.lte('created_at', new Date(filters.endDate).toISOString());
          const { data: leads } = await q.limit(lim);
          const list = (leads || []).map(l => ({ 'Name': l?.name||'', 'Email': l?.email||'', 'Status': l?.status||'', 'Tags': Array.isArray(l?.tags)?l.tags.join(', '):(l?.tags||''), 'Location': l?.location||'', 'Source': l?.source||'' }));
          const keys = Array.from(new Set(list.flatMap(r=>Object.keys(r))));
          keys.forEach(k => ensureCol(schemaLocal, k, 'text'));
          dataLocal = [...dataLocal, ...migrateRowsToKeys(list, schemaLocal)];
        } else if (src === '/candidates' || src === 'candidates') {
          const lim = filters?.importAll ? 100000 : (Number(filters?.limit) || 2000);
          let q = supabase.from('candidates').select('name,email,status,job_assigned,location,source,created_at');
          if (filters?.status) q = q.eq('status', filters.status);
          if (filters?.startDate) q = q.gte('created_at', new Date(filters.startDate).toISOString());
          if (filters?.endDate) q = q.lte('created_at', new Date(filters.endDate).toISOString());
          const { data: cands } = await q.limit(lim);
          const list = (cands || []).map(c => ({ 'Name': c?.name||'', 'Email': c?.email||'', 'Status': c?.status||'', 'Job': c?.job_assigned||'', 'Location': c?.location||'', 'Source': c?.source||'' }));
          const keys = Array.from(new Set(list.flatMap(r=>Object.keys(r))));
          keys.forEach(k => ensureCol(schemaLocal, k, 'text'));
          dataLocal = [...dataLocal, ...migrateRowsToKeys(list, schemaLocal)];
        } else if (src === '/campaigns' || src === 'campaigns') {
          const lim = filters?.importAll ? 100000 : (Number(filters?.limit) || 2000);
          let q = supabase.from('campaigns').select('name,status,leads_count,outreach_sent,reply_rate,conversion_rate,created_at');
          if (filters?.status) q = q.eq('status', filters.status);
          if (filters?.startDate) q = q.gte('created_at', new Date(filters.startDate).toISOString());
          if (filters?.endDate) q = q.lte('created_at', new Date(filters.endDate).toISOString());
          const { data: camps } = await q.limit(lim);
          const list = (camps || []).map(c => ({ 'Name': c?.name||'', 'Status': c?.status||'', 'Leads': Number(c?.leads_count)||0, 'Sent': Number(c?.outreach_sent)||0, 'ReplyRate': Number(c?.reply_rate)||0, 'ConversionRate': Number(c?.conversion_rate)||0, 'Created': c?.created_at || null }));
          const keys = Array.from(new Set(list.flatMap(r=>Object.keys(r))));
          keys.forEach(k => ensureCol(schemaLocal, k, 'text'));
          dataLocal = [...dataLocal, ...migrateRowsToKeys(list, schemaLocal)];
        }
        await supabase
          .from('custom_tables')
          .update({ schema_json: schemaLocal, data_json: dataLocal, updated_at: new Date().toISOString() })
          .eq('id', targetId);
      }
      // reload after import
      try {
        const { data } = await supabase
          .from('custom_tables')
          .select('*')
          .eq('id', targetId)
          .maybeSingle();
        const loadedSchemaRaw = Array.isArray(data?.schema_json) ? data.schema_json : [];
        const loadedRowsRaw = Array.isArray(data?.data_json) ? data.data_json : [];
        const normalizedSchema = normalizeSchema(loadedSchemaRaw);
        const migratedRows = migrateRowsToKeys(loadedRowsRaw, normalizedSchema);
        setSchema(normalizedSchema);
        setRows(recomputeFormulasRows(migratedRows));
        // Navigate to the real table route if we just created it
        if (id === 'new' && targetId && targetId !== id) {
          navigate(`/tables/${targetId}/edit`, { replace: true });
        }
      } catch {}
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const inferColumnType = (values) => {
    const sample = (Array.isArray(values) ? values : [])
      .map(v => (v == null ? '' : String(v).trim()))
      .filter(Boolean)
      .slice(0, 80);
    if (!sample.length) return 'text';

    const parseNumberLoose = (raw) => {
      const s0 = String(raw ?? '').trim();
      if (!s0) return NaN;
      let s = s0;
      let neg = false;
      if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
      s = s.replace(/[$,%\s]/g, '').replace(/,/g, '');
      if (!s) return NaN;
      const n = Number(s);
      if (!Number.isFinite(n)) return NaN;
      return neg ? -n : n;
    };

    const numberCount = sample.filter(v => Number.isFinite(parseNumberLoose(v))).length;
    const dateCount = sample.filter(v => !Number.isNaN(Date.parse(v))).length;
    const ratio = (n) => (sample.length ? n / sample.length : 0);

    if (ratio(numberCount) >= 0.9) return 'number';
    if (ratio(dateCount) >= 0.9) return 'date';
    return 'text';
  };

  const parseCsvFile = async (file) => {
    if (!file) return;
    setCsvError('');
    setCsvFile(file);
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvInfo({ name: file.name || 'upload.csv', rows: 0, cols: 0 });

    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          try {
            const headers = (results?.meta?.fields || []).map(h => String(h || '').trim()).filter(Boolean);
            const data = Array.isArray(results?.data) ? results.data : [];
            const cleaned = data
              .map(r => {
                const out = {};
                headers.forEach(h => { out[h] = r?.[h] ?? ''; });
                return out;
              })
              .filter(r => Object.values(r).some(v => String(v ?? '').trim() !== ''));
            setCsvHeaders(headers);
            setCsvRows(cleaned);
            setCsvInfo({ name: file.name || 'upload.csv', rows: cleaned.length, cols: headers.length });
          } catch (e) {
            setCsvError('Failed to parse CSV');
          }
          resolve(true);
        },
        error: (err) => {
          setCsvError(err?.message || 'Failed to parse CSV');
          resolve(false);
        }
      });
    });
  };

  const importFromCsv = async (file) => {
    if (isReadOnly) { window.alert('This table is view-only. Ask the owner for Edit access.'); return; }
    if (!file) { window.alert('Please choose a CSV file.'); return; }
    if (!csvHeaders.length || !csvRows.length) { window.alert('CSV appears empty.'); return; }
    try {
      setSaving(true);
      // Ensure we have a real table id (handle /tables/new/edit deep-link)
      let targetId = id;
      if (!targetId || targetId === 'new') {
        const payload = { name: tableName || 'Untitled Table' };
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error('Unauthenticated');
        const { data: inserted, error } = await supabase
          .from('custom_tables')
          .insert({ user_id: user.id, name: payload.name, schema_json: [], data_json: [] })
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        targetId = inserted?.id || '';
        if (!targetId) throw new Error('Failed to create table');
      }

      const ensureCol = (arr, label, type) => {
        const existing = (arr || []).find(c => String(colLabel(c)) === String(label) || String(c?.name || '') === String(label));
        if (existing) return;
        const idVal = generateId();
        const key = ensureUniqueKey(arr || [], toKey(label), idVal);
        (arr || []).push({ id: idVal, key, label, name: label, type });
      };

      const { data: tableRow } = await supabase
        .from('custom_tables')
        .select('schema_json,data_json')
        .eq('id', targetId)
        .maybeSingle();

      let schemaLocal = normalizeSchema(Array.isArray(tableRow?.schema_json) ? tableRow.schema_json : []);
      let dataLocal = migrateRowsToKeys(Array.isArray(tableRow?.data_json) ? tableRow.data_json : [], schemaLocal);

      // Create columns from headers with simple type inference
      csvHeaders.forEach((h) => {
        const values = csvRows.map(r => r?.[h]);
        ensureCol(schemaLocal, h, inferColumnType(values));
      });

      const incoming = csvRows.map((r) => {
        const out = {};
        csvHeaders.forEach((h) => { out[h] = r?.[h] ?? ''; });
        return out;
      });

      const migratedIncoming = migrateRowsToKeys(incoming, schemaLocal);
      dataLocal = csvReplaceExisting ? migratedIncoming : [...dataLocal, ...migratedIncoming];

      await supabase
        .from('custom_tables')
        .update({ schema_json: schemaLocal, data_json: dataLocal, updated_at: new Date().toISOString() })
        .eq('id', targetId);

      // reload after import
      try {
        const { data } = await supabase
          .from('custom_tables')
          .select('*')
          .eq('id', targetId)
          .maybeSingle();
        const loadedSchemaRaw = Array.isArray(data?.schema_json) ? data.schema_json : [];
        const loadedRowsRaw = Array.isArray(data?.data_json) ? data.data_json : [];
        const normalizedSchema = normalizeSchema(loadedSchemaRaw);
        const migratedRows = migrateRowsToKeys(loadedRowsRaw, normalizedSchema);
        setSchema(normalizedSchema);
        setRows(recomputeFormulasRows(migratedRows));
        if (id === 'new' && targetId && targetId !== id) {
          navigate(`/tables/${targetId}/edit`, { replace: true });
        }
      } catch {}
    } catch (e) {
      console.error('CSV import failed', e);
      window.alert('CSV import failed. Please check the file and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddColumn = async (type) => {
    if (!id) return;
    if (isReadOnly) { window.alert('This table is view-only. Ask the owner for Edit access.'); return; }
    const existingLabels = (schema || []).map((c) => String(colLabel(c) || ''));
    let idx = existingLabels.length + 1;
    let name = `New Column ${idx}`;
    while (existingLabels.includes(name)) { idx += 1; name = `New Column ${idx}`; }
    const idVal = generateId();
    const key = ensureUniqueKey(schema, toKey(name), idVal);
    let newCol = { id: idVal, key, label: name, name, type };
    if (type === 'formula') newCol = { ...newCol, formula: '=0' };
    if (type === 'money') newCol = { ...newCol, currency: 'USD' };
    const nextSchema = normalizeSchema([...schema, newCol]);
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('custom_tables')
        .update({ schema_json: nextSchema, data_json: rows, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (!error) {
        const updatedSchema = Array.isArray(data?.schema_json) ? data.schema_json : nextSchema;
        setSchema(updatedSchema);
        const backRows = Array.isArray(data?.data_json) ? data.data_json : rows;
        setRows(recomputeFormulasRows(backRows));
        if (type === 'formula') {
          const idxInSchema = updatedSchema.findIndex((c) => String(c?.id || '') === String(idVal));
          if (idxInSchema >= 0) openFormulaBuilder(idxInSchema);
        }
        addActivity(`Added ${type} column`);
      }
    } catch {}
    finally { setSaving(false); setColumnMenuOpen(false); }
  };

  const handleAddRow = async () => {
    if (!id) return;
    if (isReadOnly) { window.alert('This table is view-only. Ask the owner for Edit access.'); return; }
    const empty = {};
    (schema || []).forEach((c) => {
      const k = colKey(c);
      empty[k] = c.type === 'number' ? 0 : c.type === 'date' ? null : '';
    });
    const next = recomputeFormulasRows([...rows, empty]);
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('custom_tables')
        .update({ data_json: next, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (!error) setRows(Array.isArray(data?.data_json) ? data.data_json : next);
    } catch {}
    finally { setSaving(false); }
    addActivity('Added row');
  };

  const persistRows = async (next) => {
    try {
      await supabase
        .from('custom_tables')
        .update({ data_json: next, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch {}
  };

  const saveTimerRef = useRef(null);
  const scheduleSave = (next) => {
    try { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); } catch {}
    saveTimerRef.current = setTimeout(() => {
      persistRows(next || rows);
    }, 400);
  };

  const updateCell = (rowIdx, col, value) => {
    if (isReadOnly) return;
    // Normalize by type
    let normalized = value;
    if (col.type === 'number' || col.type === 'money') {
      const num = Number(value);
      normalized = isNaN(num) ? 0 : num;
    }
    const k = colKey(col);
    const edited = rows.map((r, i) => (i === rowIdx ? { ...r, [k]: normalized } : r));
    const next = recomputeFormulasRows(edited);
    setRows(next);
    scheduleSave(next);
    addActivity(`Edited ${col.name}`);
  };

  const persistSchemaRows = async (nextSchema, nextRows) => {
    try {
      await supabase
        .from('custom_tables')
        .update({ data_json: nextRows, schema_json: nextSchema, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch {}
  };

  const updateColumnMetaAt = async (colIdx, patch) => {
    if (isReadOnly) return;
    const col = schema?.[colIdx];
    if (!col) return;
    const nextSchema = schema.map((c, i) => (i === colIdx ? { ...(c || {}), ...(patch || {}) } : c));
    setSchema(nextSchema);
    await persistSchemaRows(nextSchema, rows);
  };

  const openStatusOptions = (colIdx) => {
    if (isReadOnly) {
      try { window.alert('This table is view-only. Ask the owner for Edit access.'); } catch {}
      return;
    }
    const col = schema?.[colIdx];
    if (!col) return;
    const initial = normalizeStatusOptions(Array.isArray(col?.status_options) ? col.status_options : DEFAULT_STATUS_OPTIONS);
    setStatusOptionsColIdx(colIdx);
    setStatusOptionsDraft(initial);
    setStatusOptionsInput('');
    setShowStatusOptionsModal(true);
  };

  const closeStatusOptions = () => {
    setShowStatusOptionsModal(false);
    setStatusOptionsColIdx(null);
    setStatusOptionsDraft([]);
    setStatusOptionsInput('');
  };

  const saveStatusOptions = async () => {
    if (isReadOnly) return;
    const colIdx = statusOptionsColIdx;
    const col = schema?.[colIdx];
    if (colIdx == null || !col) return;
    const cleaned = normalizeStatusOptions(statusOptionsDraft);
    const defaultsClean = normalizeStatusOptions(DEFAULT_STATUS_OPTIONS);
    const isSameAsDefaults = cleaned.length === defaultsClean.length && cleaned.every((v, i) => v === defaultsClean[i]);
    const nextSchema = schema.map((c, i) => {
      if (i !== colIdx) return c;
      if (isSameAsDefaults) {
        const { status_options, ...rest } = c || {};
        return rest;
      }
      return { ...(c || {}), status_options: cleaned };
    });
    // Persist schema only (avoid overwriting data_json) and read back the canonical schema_json.
    try {
      setSchema(nextSchema);
      const { data, error } = await supabase
        .from('custom_tables')
        .update({ schema_json: nextSchema, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('schema_json')
        .maybeSingle();
      if (!error && data?.schema_json) {
        const normalized = normalizeSchema(Array.isArray(data.schema_json) ? data.schema_json : nextSchema);
        setSchema(normalized);
      }
    } catch {}
    addActivity(`Updated status options for ${colLabel(col)}`);
    closeStatusOptions();
  };

  const ensureUniqueColName = (base) => {
    const taken = new Set((schema||[]).map(c => String(c.name)));
    if (!taken.has(base)) return base;
    let i = 2; let candidate = `${base} (${i})`;
    while (taken.has(candidate)) { i += 1; candidate = `${base} (${i})`; }
    return candidate;
  };

  const deleteColumnAt = async (colIdx) => {
    if (isReadOnly) { window.alert('This table is view-only. Ask the owner for Edit access.'); return; }
    const col = schema[colIdx]; if (!col) return;
    const nextSchema = schema.filter((_, i) => i !== colIdx);
    const k = colKey(col);
    const nextRows = (rows||[]).map(r => { const { [k]: _drop, ...rest } = r || {}; return rest; });
    setSchema(nextSchema); setRows(nextRows); setColumnMenuIdx(null);
    await persistSchemaRows(nextSchema, nextRows);
    addActivity(`Deleted column ${col.name}`);
  };

  const renameColumnAt = async (colIdx, name) => {
    if (isReadOnly) return;
    const col = schema[colIdx]; if (!col) return;
    // Rename affects display label only; key stays stable so dashboards don’t break.
    const newLabel = name && name.trim() ? name.trim() : colLabel(col);
    const nextSchema = schema.map((c, i) => i===colIdx ? { ...c, label: newLabel, name: newLabel } : c);
    setSchema(nextSchema); setColumnMenuIdx(null);
    await persistSchemaRows(nextSchema, rows);
    addActivity(`Renamed column to ${newLabel}`);
  };

  const changeColumnTypeAt = async (colIdx, newType, newCurrency) => {
    if (isReadOnly) { window.alert('This table is view-only. Ask the owner for Edit access.'); return; }
    const col = schema[colIdx]; if (!col) return;
    const oldType = String(col?.type || 'text');
    const targetType = String(newType || 'text');
    if (oldType === targetType) return;

    const k = colKey(col);
    const rawVals = (rows || []).map(r => (r || {})[k]);
    const nonEmpty = rawVals
      .map(v => (v == null ? '' : String(v).trim()))
      .filter(v => v !== '');

    const parseNumberLoose = (raw) => {
      const s0 = String(raw ?? '').trim();
      if (!s0) return NaN;
      let s = s0;
      let neg = false;
      if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
      s = s.replace(/[$,%\s]/g, '').replace(/,/g, '');
      if (!s) return NaN;
      const n = Number(s);
      if (!Number.isFinite(n)) return NaN;
      return neg ? -n : n;
    };

    const toDateYmd = (raw) => {
      const s = String(raw ?? '').trim();
      if (!s) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const t = Date.parse(s);
      if (Number.isNaN(t)) return null;
      const d = new Date(t);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const failIfIncompatible = (targetLabel, invalidSamples) => {
      const samples = invalidSamples.slice(0, 5).map(v => `"${String(v).slice(0, 60)}"`).join(', ');
      window.alert(
        `Cannot convert this column to ${targetLabel} because some values are not compatible.\n\n` +
        `Fix or clear these values first, then try again.\n\n` +
        `Examples: ${samples}${invalidSamples.length > 5 ? ' …' : ''}`
      );
    };

    // Compatibility gate: only allow conversion when ALL non-empty values convert.
    if (targetType === 'number' || targetType === 'money') {
      const invalid = nonEmpty.filter(v => !Number.isFinite(parseNumberLoose(v)));
      if (invalid.length) {
        failIfIncompatible(targetType === 'money' ? 'Money' : 'Number', invalid);
        return;
      }
    }
    if (targetType === 'date') {
      const invalid = nonEmpty.filter(v => !toDateYmd(v));
      if (invalid.length) {
        failIfIncompatible('Date', invalid);
        return;
      }
    }

    const nextSchema = schema.map((c, i) => {
      if (i !== colIdx) return c;
      const updated = { ...c, type: targetType };
      if (targetType === 'money' || targetType === 'formula') {
        updated.currency = newCurrency || c.currency || 'USD';
      } else if (updated.currency) {
        delete updated.currency;
      }
      if (targetType === 'formula' && !updated.formula) updated.formula = '=0';
      return updated;
    });
    let nextRows = rows;
    if (targetType === 'number' || targetType === 'money') {
      nextRows = (rows || []).map(r => {
        const raw = (r || {})[k];
        const s = String(raw ?? '').trim();
        const converted = s === '' ? 0 : parseNumberLoose(raw);
        return { ...(r || {}), [k]: Number.isFinite(converted) ? converted : 0 };
      });
    } else if (targetType === 'date') {
      nextRows = (rows || []).map(r => {
        const raw = (r || {})[k];
        const s = String(raw ?? '').trim();
        const converted = s === '' ? null : toDateYmd(raw);
        return { ...(r || {}), [k]: converted };
      });
    } else {
      // text/status/formula: non-destructive
      nextRows = rows;
    }
    nextRows = recomputeFormulasRows(nextRows);
    setSchema(nextSchema); setRows(nextRows); setColumnMenuIdx(null);
    await persistSchemaRows(nextSchema, nextRows);
    addActivity(`Changed column type to ${targetType}`);
  };

  // Close column menu on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      try {
        if (!menuRef.current) {
          setColumnMenuIdx(null);
          setColumnMenuPos(null);
          return;
        }
        if (!menuRef.current.contains(e.target)) {
          setColumnMenuIdx(null);
          setColumnMenuPos(null);
        }
      } catch {
        setColumnMenuIdx(null);
        setColumnMenuPos(null);
      }
    };
    if (columnMenuIdx !== null) {
      document.addEventListener('click', onDocClick);
    }
    return () => {
      document.removeEventListener('click', onDocClick);
    };
  }, [columnMenuIdx]);

  // Keep selected column index valid as schema changes
  useEffect(() => {
    if (selectedColIdx === null) return;
    if (!Array.isArray(schema) || selectedColIdx < 0 || selectedColIdx >= schema.length) {
      setSelectedColIdx(null);
    }
  }, [schema, selectedColIdx]);

  const toggleSelectRow = (idx, checked) => {
    const set = new Set(selectedRowIdxSet);
    if (checked) set.add(idx); else set.delete(idx);
    setSelectedRowIdxSet(set);
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      const set = new Set((rows||[]).map((_, i)=>i));
      setSelectedRowIdxSet(set);
    } else {
      setSelectedRowIdxSet(new Set());
    }
  };

  const bulkDeleteSelected = async () => {
    if (!selectedRowIdxSet.size) return;
    if (isReadOnly) { window.alert('This table is view-only. Ask the owner for Edit access.'); return; }
    const count = selectedRowIdxSet.size;
    let proceed = true;
    try { proceed = window.confirm(`Delete ${count} selected row${count > 1 ? 's' : ''}? This cannot be undone.`); } catch {}
    if (!proceed) return;
    const next = (rows || []).filter((_, i) => !selectedRowIdxSet.has(i));
    setRows(next); setSelectedRowIdxSet(new Set());
    await persistRows(next);
    addActivity(`Deleted ${count} row${count>1?'s':''}`);
  };

  const clearActiveCell = async () => {
    try {
      if (isReadOnly) return;
      const ri = selectedRowIndex;
      const ci = activeColIdx;
      const col = schema?.[ci];
      if (ri == null || ri < 0 || !col) return;
      updateCell(ri, col, '');
      addActivity(`Cleared ${colLabel(col)}`);
    } catch {}
  };

  const applyValueToColumn = (colIdx, value) => {
    try {
      if (isReadOnly) return;
      const col = schema?.[colIdx];
      if (!col) return;
      if (col.type === 'formula') return;
      let normalized = value;
      if (col.type === 'number' || col.type === 'money') {
        const num = Number(value);
        normalized = isNaN(num) ? 0 : num;
      }
      const k = colKey(col);
      const edited = (rows || []).map((r) => ({ ...(r || {}), [k]: normalized }));
      const next = recomputeFormulasRows(edited);
      setRows(next);
      scheduleSave(next);
      addActivity(`Filled column ${colLabel(col)}`);
    } catch {}
  };

  const closeTopUI = () => {
    if (showCommandPalette) { setShowCommandPalette(false); setCommandQuery(''); return true; }
    if (showShortcuts) { setShowShortcuts(false); return true; }
    if (editingCell) { cancelEditingCell(); return true; }
    if (showStatusOptionsModal) { closeStatusOptions(); return true; }
    if (showFormulaModal) { setShowFormulaModal(false); return true; }
    if (showImportModal) { setShowImportModal(false); return true; }
    if (showShare) { setShowShare(false); return true; }
    if (columnMenuIdx !== null) { setColumnMenuIdx(null); return true; }
    if (columnMenuOpen) { setColumnMenuOpen(false); return true; }
    return false;
  };

  const commands = useMemo(() => {
    const list = [];
    list.push({ id: 'add_row', title: 'Add row', shortcut: '⌘Enter', enabled: !isReadOnly, run: () => handleAddRow() });
    list.push({ id: 'delete_selected', title: 'Delete selected rows…', shortcut: 'Del', enabled: !isReadOnly && selectedRowIdxSet.size > 0, run: () => bulkDeleteSelected() });
    list.push({ id: 'clear_cell', title: 'Clear active cell', shortcut: 'Del', enabled: !isReadOnly && selectedRowIndex >= 0 && !!schema?.[activeColIdx], run: () => clearActiveCell() });
    list.push({ id: 'rename_table', title: 'Rename table', shortcut: '', enabled: !isReadOnly, run: () => { try { tableNameInputRef.current?.focus(); tableNameInputRef.current?.select?.(); } catch {} } });
    list.push({ id: 'import_data', title: 'Import data…', shortcut: '', enabled: !isReadOnly, run: () => { setImportSource('/leads'); setShowImportModal(true); } });
    list.push({ id: 'share', title: 'Share…', shortcut: '', enabled: canManageAccess, run: () => setShowShare(true) });
    list.push({ id: 'add_col_text', title: 'Add column: Text', shortcut: '', enabled: !isReadOnly, run: () => handleAddColumn('text') });
    list.push({ id: 'add_col_status', title: 'Add column: Status', shortcut: '', enabled: !isReadOnly, run: () => handleAddColumn('status') });
    list.push({ id: 'add_col_number', title: 'Add column: Number', shortcut: '', enabled: !isReadOnly, run: () => handleAddColumn('number') });
    list.push({ id: 'add_col_money', title: 'Add column: Money', shortcut: '', enabled: !isReadOnly, run: () => handleAddColumn('money') });
    list.push({ id: 'add_col_date', title: 'Add column: Date', shortcut: '', enabled: !isReadOnly, run: () => handleAddColumn('date') });
    list.push({ id: 'add_col_formula', title: 'Add column: Formula', shortcut: '', enabled: !isReadOnly, run: () => handleAddColumn('formula') });

    const activeCol = schema?.[activeColIdx];
    if (activeCol?.type === 'status') {
      list.push({ id: 'customize_status', title: `Customize status options (${colLabel(activeCol)})…`, shortcut: '', enabled: !isReadOnly, run: () => openStatusOptions(activeColIdx) });
    }
    if (activeCol?.type === 'formula') {
      list.push({ id: 'edit_formula', title: `Edit formula (${colLabel(activeCol)})…`, shortcut: '', enabled: !isReadOnly, run: () => openFormulaBuilder(activeColIdx) });
    }

    return list;
  }, [isReadOnly, selectedRowIdxSet, selectedRowIndex, activeColIdx, schema, canManageAccess, showCommandPalette, showShortcuts]);

  const filteredCommands = useMemo(() => {
    const q = String(commandQuery || '').trim().toLowerCase();
    const base = commands.filter((c) => c.enabled);
    if (!q) return base;
    return base.filter((c) => String(c.title).toLowerCase().includes(q));
  }, [commands, commandQuery]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const key = String(e.key || '');
      const meta = !!e.metaKey;
      const ctrl = !!e.ctrlKey;

      // Always allow Esc to close the top-most UI.
      if (key === 'Escape') {
        const closed = closeTopUI();
        if (closed) e.preventDefault();
        return;
      }

      // Shortcuts overlay: Shift+/ (i.e., '?')
      if ((key === '?' || (key === '/' && e.shiftKey)) && !meta && !ctrl) {
        if (!showCommandPalette) {
          e.preventDefault();
          setShowShortcuts(true);
        }
        return;
      }

      // Command palette: Cmd/Ctrl+K
      if ((meta || ctrl) && key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
        setShowShortcuts(false);
        return;
      }

      // If typing in an input/textarea/select, don't hijack keystrokes (except meta/ctrl combos above).
      if (isEditableTarget(document.activeElement)) return;

      // Don't move around the grid if any modal/palette is open.
      if (showCommandPalette || showShortcuts || showStatusOptionsModal || showFormulaModal || showImportModal || showShare) return;

      const maxRow = (rows || []).length - 1;
      const maxCol = (schema || []).length - 1;
      const hasGrid = maxRow >= 0 && maxCol >= 0;
      const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
      const setSelection = (ri, ci) => {
        if (!hasGrid) return;
        setSelectedRowIndex(clamp(ri, 0, maxRow));
        setActiveColIdx(clamp(ci, 0, maxCol));
      };

      // Grid navigation (navigate mode only)
      if (!editingCell && hasGrid) {
        if (key === 'ArrowUp') { e.preventDefault(); setSelection((selectedRowIndex >= 0 ? selectedRowIndex : 0) - 1, activeColIdx); return; }
        if (key === 'ArrowDown') { e.preventDefault(); setSelection((selectedRowIndex >= 0 ? selectedRowIndex : 0) + 1, activeColIdx); return; }
        if (key === 'ArrowLeft') { e.preventDefault(); setSelection(selectedRowIndex >= 0 ? selectedRowIndex : 0, activeColIdx - 1); return; }
        if (key === 'ArrowRight') { e.preventDefault(); setSelection(selectedRowIndex >= 0 ? selectedRowIndex : 0, activeColIdx + 1); return; }

        if (key === 'Tab') {
          e.preventDefault();
          const ri = selectedRowIndex >= 0 ? selectedRowIndex : 0;
          const ci = activeColIdx;
          const dir = e.shiftKey ? -1 : 1;
          let nextCi = ci + dir;
          let nextRi = ri;
          if (nextCi > maxCol) { nextCi = 0; nextRi = ri + 1; }
          if (nextCi < 0) { nextCi = maxCol; nextRi = ri - 1; }
          nextRi = clamp(nextRi, 0, maxRow);
          setSelection(nextRi, nextCi);
          return;
        }

        if (key === 'Enter') {
          e.preventDefault();
          const ri = selectedRowIndex >= 0 ? selectedRowIndex : 0;
          const ci = activeColIdx;
          startEditingCell(ri, ci);
          return;
        }
      }

      // Add row: Cmd/Ctrl+Enter
      if ((meta || ctrl) && key === 'Enter') {
        e.preventDefault();
        if (!isReadOnly) handleAddRow();
        return;
      }

      // Delete behavior: if rows are selected, delete them; else clear the active cell.
      if (key === 'Backspace' || key === 'Delete') {
        if (isReadOnly) return;
        e.preventDefault();
        if (selectedRowIdxSet.size > 0) bulkDeleteSelected();
        else clearActiveCell();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isReadOnly,
    selectedRowIdxSet,
    selectedRowIndex,
    activeColIdx,
    rows,
    schema,
    showCommandPalette,
    showShortcuts,
    showStatusOptionsModal,
    showFormulaModal,
    showImportModal,
    showShare,
    columnMenuIdx,
    columnMenuOpen,
  ]);

  useEffect(() => {
    if (!showCommandPalette) return;
    try {
      setTimeout(() => commandInputRef.current?.focus?.(), 0);
    } catch {}
  }, [showCommandPalette]);

  const renderEditableCell = (row, col, rowIdx, colIdx) => {
    const k = colKey(col);
    const val = row?.[k] ?? '';
    const isEditing = !!editingCell && editingCell.rowIdx === rowIdx && editingCell.colIdx === colIdx;
    const commonClass = "w-full bg-transparent border-none outline-none focus:bg-white dark:focus:bg-gray-800 focus:border focus:border-purple-300 dark:focus:border-gray-600 rounded px-2 py-1 dark:text-gray-200 dark:placeholder-gray-400";

    // Navigate mode (display-only)
    if (!isEditing) {
      const display = (() => {
        if (val === null || val === undefined || val === '') return '';
        if (col.type === 'money') {
          const n = Number(String(val ?? '').replace(/[^0-9.-]/g, '')) || 0;
          const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: col.currency || 'USD' });
          return fmt.format(n);
        }
        if (col.type === 'formula') {
          return formatNumberForColumn(col, val);
        }
        if (col.type === 'number') {
          const n = Number(val) || 0;
          return numberFormatter.format(n);
        }
        if (col.type === 'date') return String(val).slice(0, 10);
        return String(val);
      })();
      const isSelected = selectedRowIndex === rowIdx && activeColIdx === colIdx;
      return (
        <div className={`px-2 py-1 min-h-[32px] flex items-center rounded ${isSelected ? 'ring-2 ring-purple-300 bg-purple-50/40' : ''}`}>
          <span className={`text-sm ${display ? 'text-gray-900' : 'text-gray-400'}`}>{display}</span>
        </div>
      );
    }

    // Edit mode (editor)
    if (col.type === 'number' || col.type === 'money') {
      if (col.type === 'money') {
        const currencySymbol = (cur) => (cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : '$');
        return (
          <div className="flex items-center">
            <span className="text-gray-500 mr-1">{currencySymbol(col.currency || 'USD')}</span>
            <input
              type="number"
              step="0.01"
              autoFocus
              value={editDraftValue}
              onChange={(e)=> setEditDraftValue(e.target.value)}
              onBlur={() => commitEditingCell()}
              onKeyDown={(e)=> {
                if (e.key === 'Enter') { e.preventDefault(); commitEditingCell(); }
                if (e.key === 'Escape') { e.preventDefault(); cancelEditingCell(); }
              }}
              className={commonClass}
            />
          </div>
        );
      }
      return (
        <input
          type="number"
          step="1"
          autoFocus
          value={editDraftValue}
          onChange={(e)=> setEditDraftValue(e.target.value)}
          onBlur={() => commitEditingCell()}
          onKeyDown={(e)=> {
            if (e.key === 'Enter') { e.preventDefault(); commitEditingCell(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelEditingCell(); }
          }}
          className={commonClass}
        />
      );
    }

    if (col.type === 'date') {
      return (
        <input
          type="date"
          autoFocus
          value={String(editDraftValue || '').slice(0,10)}
          onChange={(e)=> { const v = e.target.value; setEditDraftValue(v); commitEditingCell(v); }}
          onBlur={() => commitEditingCell()}
          onKeyDown={(e)=> {
            if (e.key === 'Escape') { e.preventDefault(); cancelEditingCell(); }
          }}
          className={commonClass}
        />
      );
    }

    if (col.type === 'status') {
      const custom = normalizeStatusOptions(col?.status_options);
      const base = custom.length ? custom : DEFAULT_STATUS_OPTIONS;
      const existing = Array.from(new Set((rows||[]).map(r => String((r||{})[k] ?? '')).filter(Boolean)));
      const baseSet = new Set(base.map((x) => String(x).toLowerCase()));
      const extras = existing.filter((x) => x && !baseSet.has(String(x).toLowerCase()));
      return (
        <select
          autoFocus
          value={String(editDraftValue || '')}
          onChange={(e)=> {
            const nextVal = e.target.value;
            if (nextVal === '__custom__') {
              cancelEditingCell();
              openStatusOptions(colIdx);
              return;
            }
            setEditDraftValue(nextVal);
            commitEditingCell(nextVal);
          }}
          onBlur={() => commitEditingCell()}
          onKeyDown={(e)=> {
            if (e.key === 'Escape') { e.preventDefault(); cancelEditingCell(); }
          }}
          className={commonClass}
        >
          <option value=""></option>
          {base.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
          {!!extras.length && (
            <optgroup label="In table data">
              {extras.map(opt => (
                <option key={`extra_${opt}`} value={opt}>{opt}</option>
              ))}
            </optgroup>
          )}
          <option disabled value="__sep__">────────</option>
          <option value="__custom__">Custom…</option>
        </select>
      );
    }

    // Text fallback
    return (
      <input
        type="text"
        autoFocus
        value={String(editDraftValue)}
        onChange={(e)=> setEditDraftValue(e.target.value)}
        onBlur={() => commitEditingCell()}
        onKeyDown={(e)=> {
          if (e.key === 'Enter') { e.preventDefault(); commitEditingCell(); }
          if (e.key === 'Escape') { e.preventDefault(); cancelEditingCell(); }
        }}
        className={commonClass}
      />
    );
  };

  const numberFormatter = useMemo(()=> new Intl.NumberFormat('en-US'), []);
  const currencyFormatter = useMemo(()=> new Intl.NumberFormat('en-US',{ style:'currency', currency:'USD' }), []);

  const totals = useMemo(() => {
    const acc = {};
    for (const c of (schema || [])) {
      if ([ 'number','money','formula' ].includes(c?.type)) {
        let sum = 0;
        for (const r of (rows || [])) {
          const raw = r?.[colKey(c)];
          let n = 0;
          if (c.type === 'money') n = Number(String(raw ?? '').replace(/[^0-9.-]/g, '')) || 0;
          else n = Number(raw) || 0;
          sum += isNaN(n) ? 0 : n;
        }
        acc[colKey(c)] = sum;
      }
    }
    return acc;
  }, [rows, schema]);

  const updateColumnWidthAt = async (colIdx, widthPx) => {
    if (isReadOnly) return;
    const col = schema[colIdx]; if (!col) return;
    const w = Math.max(60, Math.min(600, Number(widthPx) || 0));
    const nextSchema = schema.map((c, i) => i===colIdx ? { ...c, width: w } : c);
    setSchema(nextSchema);
    await persistSchemaRows(nextSchema, rows);
    addActivity(`Changed width of ${col.name} to ${w}px`);
  };

  // Handle drag-and-drop reorder
  const handleHeaderDragStart = (ci) => (e) => {
    try { e.dataTransfer.effectAllowed = 'move'; } catch {}
    setDragColIdx(ci);
  };
  const handleHeaderDragOver = (targetIdx) => (e) => {
    e.preventDefault();
    e.dataTransfer && (e.dataTransfer.dropEffect = 'move');
  };
  const handleHeaderDrop = (targetIdx) => async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    const from = dragColIdx;
    setDragColIdx(null);
    if (from == null || from === targetIdx) return;
    const next = [...schema];
    const [moved] = next.splice(from, 1);
    next.splice(targetIdx, 0, moved);
    setSchema(next);
    await persistSchemaRows(next, rows);
    addActivity(`Moved column to position ${targetIdx + 1}`);
  };

  // Resizer
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      const dx = (e.clientX || 0) - resizing.startX;
      const w = Math.max(60, Math.min(800, (resizing.startW || 200) + dx));
      setSchema((s) => s.map((c, i) => (i === resizing.idx ? { ...c, width: w } : c)));
    };
    const onUp = async () => {
      const finalW = (schema[resizing.idx]?.width) || resizing.startW || 200;
      setResizing(null);
      await updateColumnWidthAt(resizing.idx, finalW);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, schema]);

  return (
    <div className="bg-gray-50 font-sans min-h-screen flex flex-col">
      {/* EXACT SOURCE START (layout/content preserved as-is) */}
      <div id="table-editor" className="min-h-screen flex flex-col">
        <header id="header" className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="text-gray-600 hover:text-gray-800 transition-colors" onClick={() => navigate('/tables')}>
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div className="relative">
                <i className="fas fa-pen text-gray-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e)=>setTableName(e.target.value)}
                  onBlur={() => { if (tableName && tableName.trim() !== lastSavedName) onSave(); }}
                  placeholder="Name your table…"
                  title="Click to rename your table"
                  disabled={isReadOnly}
                  ref={tableNameInputRef}
                  className="pl-7 pr-3 text-2xl font-semibold text-gray-900 bg-gray-50 border border-transparent outline-none focus:bg-white focus:border-purple-300 rounded px-2 py-1 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isReadOnly && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                  View only
                </span>
              )}
              <button onClick={() => { if (canManageAccess) setShowShare(true); else window.alert('Only team admins can manage access'); }} className="px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-60" disabled={!canManageAccess}>
                <i className="fas fa-share-alt mr-2"></i>Share
              </button>
              <button onClick={onSave} disabled={saving || isReadOnly} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-70">
                <i className="fas fa-save mr-2"></i>{saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </header>
        <div id="toolbar" className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-4">
            {selectedColIdx !== null && schema?.[selectedColIdx] && (
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200">
                <div className="text-sm text-purple-900">
                  Column selected: <span className="font-medium">{schema[selectedColIdx].name}</span>
                  <span className="text-purple-700 ml-2">Edits apply to all rows.</span>
                </div>
                <button
                  className="text-purple-700 hover:text-purple-900 text-sm"
                  onClick={()=> setSelectedColIdx(null)}
                  title="Clear column selection"
                >
                  Clear
                </button>
              </div>
            )}
            <div className="relative">
              <button id="add-column-btn" disabled={isReadOnly} onClick={() => setColumnMenuOpen(v=>!v)} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60 dark:text-gray-100">
                <i className="fas fa-plus text-sm"></i>
                Add Column
                <i className="fas fa-chevron-down text-xs"></i>
              </button>
              <div id="column-dropdown" className={`${columnMenuOpen ? '' : 'hidden'} absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50`}>
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">COLUMN TYPES</div>
                  <div className="space-y-1">
                    <button onClick={()=>handleAddColumn('text')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-900 dark:text-gray-100"><i className="fas fa-font text-gray-400"></i>Text</button>
                    <button onClick={()=>handleAddColumn('status')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-900 dark:text-gray-100"><i className="fas fa-circle text-purple-400"></i>Status</button>
                    <button onClick={()=>handleAddColumn('number')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-900 dark:text-gray-100"><i className="fas fa-hashtag text-gray-400"></i>Number</button>
                    <button onClick={()=>handleAddColumn('money')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-900 dark:text-gray-100"><i className="fas fa-dollar-sign text-green-600"></i>Money</button>
                    <button onClick={()=>handleAddColumn('date')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-900 dark:text-gray-100"><i className="fas fa-calendar text-gray-400"></i>Date</button>
                    <button onClick={()=>handleAddColumn('formula')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-900 dark:text-gray-100"><i className="fas fa-calculator text-gray-400"></i>Formula</button>
                  </div>
                  <div className="border-t mt-2 pt-2">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">FROM APP SOURCES</div>
                    <button onClick={()=>{ setImportSource('/deals'); setShowImportModal(true); }} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-300 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /deals
                    </button>
                    <button onClick={()=>{ setImportSource('/leads'); setShowImportModal(true); }} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-300 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /leads
                    </button>
                    <button onClick={()=>{ setImportSource('/candidates'); setShowImportModal(true); }} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-300 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /candidates
                    </button>
                    <button onClick={()=>{ setImportSource('/campaigns'); setShowImportModal(true); }} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-300 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /campaigns
                    </button>
                    <button onClick={()=>{ setImportSource('/jobs'); setShowImportModal(true); }} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-300 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /jobs
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={handleAddRow} disabled={isReadOnly} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60 dark:text-gray-100">
              <i className="fas fa-plus text-sm"></i>Add Row
            </button>
            <button onClick={bulkDeleteSelected} disabled={!selectedRowIdxSet.size || isReadOnly} className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${(!selectedRowIdxSet.size || isReadOnly) ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-red-700 border-red-300 hover:bg-red-50'}`}>
              <i className="fas fa-trash"></i>Delete Selected
            </button>
            <button disabled={isReadOnly} onClick={()=>{ setImportSource('/leads'); setShowImportModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60 dark:text-gray-100">
              <i className="fas fa-upload text-sm"></i>Import Data
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <button
                title="Keyboard shortcuts (?)"
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                onClick={()=> setShowShortcuts(true)}
              >
                <i className="fas fa-keyboard"></i>
              </button>
              <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"><i className="fas fa-filter"></i></button>
              <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"><i className="fas fa-sort"></i></button>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                <i className="fas fa-robot mr-2"></i>Ask REX
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* min-w-0 is critical here: without it, wide tables force the flex item to expand,
              and the parent overflow-hidden clips columns instead of allowing horizontal scroll. */}
          <main id="main-grid" className="flex-1 p-6 min-w-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div id="table-container" className="overflow-x-auto overflow-y-auto touch-pan-x overscroll-x-contain" style={{ height: 'calc(100vh - 200px)', WebkitOverflowScrolling: 'touch' }}>
                <table className="min-w-max w-max whitespace-nowrap table-auto">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-12 px-4 py-3 text-left"><input type="checkbox" className="rounded border-gray-300" onChange={(e)=>toggleSelectAll(e.target.checked)} checked={selectedRowIdxSet.size>0 && selectedRowIdxSet.size===(rows||[]).length} /></th>
                      {schema.map((col, ci) => (
                        <th
                          key={col.name}
                          className={`px-4 py-3 text-left text-sm font-medium border-r border-gray-300 min-w-40 relative select-none ${activeColIdx===ci?'bg-purple-50/40':''} ${selectedColIdx===ci?'bg-purple-100/60 ring-2 ring-purple-300':''}`}
                          style={{ width: col.width ? `${col.width}px` : undefined, minWidth: col.width ? `${col.width}px` : undefined }}
                          onClick={()=> setActiveColIdx(ci)}
                          draggable={true}
                          onDragStart={handleHeaderDragStart(ci)}
                          onDragOver={handleHeaderDragOver(ci)}
                          onDrop={handleHeaderDrop(ci)}
                        >
                          <div className="flex items-center gap-2">
                            {inlineEditIdx === ci ? (
                              <input
                                className="px-2 py-1 border rounded bg-white"
                                value={inlineEditName}
                                autoFocus
                                onChange={(e)=>setInlineEditName(e.target.value)}
                                onBlur={async()=>{ await renameColumnAt(ci, inlineEditName); setInlineEditIdx(null); }}
                                onKeyDown={async(e)=>{
                                  if (e.key === 'Enter') { await renameColumnAt(ci, inlineEditName); setInlineEditIdx(null); }
                                  if (e.key === 'Escape') { setInlineEditIdx(null); }
                                }}
                              />
                            ) : (
                              <>
                                <span>{col.name}</span>
                                <button title="Rename column" className="text-gray-400 hover:text-gray-600" onClick={(e)=>{ e.stopPropagation(); setInlineEditIdx(ci); setInlineEditName(col.name); }}>
                                  <i className="fas fa-pencil-alt text-xs"></i>
                                </button>
                              </>
                            )}
                            {col.type === 'formula' && (
                              <button title="Edit formula" className="text-purple-500 hover:text-purple-700" onClick={()=>openFormulaBuilder(ci)}>
                                <i className="fas fa-calculator text-xs"></i>
                              </button>
                            )}
                            <button
                              title={selectedColIdx===ci ? 'Clear column selection' : 'Select entire column (edits apply to all rows)'}
                              className={`ml-1 ${selectedColIdx===ci ? 'text-purple-700' : 'text-gray-400'} hover:text-purple-700`}
                              onClick={(e)=>{ e.stopPropagation(); setSelectedColIdx(selectedColIdx===ci ? null : ci); }}
                            >
                              <i className={selectedColIdx===ci ? 'fas fa-check-square text-xs' : 'far fa-square text-xs'}></i>
                            </button>
                            <i className="fas fa-grip-vertical text-gray-500 cursor-move" title="Drag to reorder"></i>
                            <button
                              className="ml-1 text-gray-400 hover:text-gray-600"
                              onClick={(e)=> {
                                e.stopPropagation();
                                const nextIdx = columnMenuIdx === ci ? null : ci;
                                if (nextIdx === null) {
                                  setColumnMenuIdx(null);
                                  setColumnMenuPos(null);
                                  return;
                                }
                                setColumnMenuIdx(nextIdx);
                                setEditColName(col.name);
                                setEditColType(col.type);
                                setEditCurrency((col && col.currency) ? col.currency : 'USD');
                                try {
                                  const r = e.currentTarget.getBoundingClientRect();
                                  const menuW = 224; // w-56
                                  const pad = 8;
                                  const left = Math.max(pad, Math.min((window.innerWidth || 0) - menuW - pad, (r.right - menuW)));
                                  const top = Math.min((window.innerHeight || 0) - pad, r.bottom + 8);
                                  setColumnMenuPos({ top, left });
                                } catch {
                                  setColumnMenuPos({ top: 80, left: 80 });
                                }
                              }}
                            >
                              <i className="fas fa-ellipsis-h"></i>
                            </button>
                          </div>
                          {/* Resizer */}
                          <span
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent"
                            onMouseDown={(e)=> setResizing({ idx: ci, startX: e.clientX || 0, startW: Number(col.width) || 200 })}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr className="border-b border-gray-100">
                        <td colSpan={schema.length + 1} className="px-4 py-6 text-center text-gray-500">No rows yet. Import or add rows to get started.</td>
                      </tr>
                    )}
                    {rows.map((r, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors border-b border-gray-300 ${selectedRowIndex === idx ? 'bg-purple-50 dark:bg-gray-800' : 'hover:bg-purple-50 dark:hover:bg-gray-800'}`}
                        onClick={()=>{
                          setSelectedRowIndex(idx);
                          if (activeColIdx == null || activeColIdx < 0) setActiveColIdx(0);
                        }}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            onChange={(e)=>toggleSelectRow(idx, e.target.checked)}
                            checked={selectedRowIdxSet.has(idx)}
                          />
                        </td>
                        {schema.map((col, ci) => (
                          <td
                            key={`${idx}-${col.id || col.key || col.name}`}
                            className={`px-2 py-1 border-r border-gray-300 ${selectedColIdx===ci ? 'bg-purple-50/30' : ''}`}
                            style={{ width: col.width ? `${col.width}px` : undefined }}
                            onClick={(e)=> { e.stopPropagation(); setSelectedRowIndex(idx); setActiveColIdx(ci); }}
                            onDoubleClick={(e)=> { e.stopPropagation(); setSelectedRowIndex(idx); setActiveColIdx(ci); startEditingCell(idx, ci); }}
                          >
                            {renderEditableCell(r, col, idx, ci)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-4 py-2 text-right font-semibold text-gray-700">Total</td>
                      {schema.map((col) => (
                        <td key={`total-${col.id || col.key || col.name}`} className="px-4 py-2 text-right font-semibold text-gray-900 border-r border-gray-300">
                          {['number','money','formula'].includes(col.type)
                            ? (col.type === 'money'
                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: (col && col.currency) ? col.currency : 'USD' }).format(Number(totals[colKey(col)] || 0))
                                : col.type === 'formula'
                                  ? formatNumberForColumn(col, Number(totals[colKey(col)] || 0))
                                  : numberFormatter.format(Number(totals[colKey(col)] || 0)))
                            : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </main>
          <aside id="sidebar" className="w-80 bg-white border-l border-gray-200 p-6 space-y-6 hidden md:block">
            <section>
              <h3 className="text-lg font-semibold mb-4">Column Settings</h3>
              {schema[activeColIdx] ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Column Name</label>
                    <input className="w-full px-3 py-2 border rounded" value={schema[activeColIdx].name} onChange={(e)=> setSchema(s=> s.map((c,i)=> i===activeColIdx?{...c, name:e.target.value}:c))} onBlur={()=> renameColumnAt(activeColIdx, schema[activeColIdx].name)} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Column Type</label>
                    <select className="w-full px-3 py-2 border rounded" value={schema[activeColIdx].type} onChange={(e)=> changeColumnTypeAt(activeColIdx, e.target.value, schema[activeColIdx].currency)}>
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="money">money</option>
                      <option value="status">status</option>
                      <option value="date">date</option>
                      <option value="formula">formula</option>
                    </select>
                  </div>
                  {schema[activeColIdx].type === 'money' && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Currency</label>
                      <select className="w-full px-3 py-2 border rounded" value={schema[activeColIdx].currency || 'USD'} onChange={(e)=> changeColumnTypeAt(activeColIdx, 'money', e.target.value)}>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                  )}
                  {schema[activeColIdx].type === 'formula' && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Formula</label>
                      <div className="flex gap-2">
                        <input className="flex-1 px-3 py-2 border rounded" value={schema[activeColIdx].formula || ''} onChange={(e)=> setSchema(s=> s.map((c,i)=> i===activeColIdx?{...c, formula:e.target.value}:c))} />
                        <button className="px-3 py-2 border rounded" onClick={()=> openFormulaBuilder(activeColIdx)}>Builder</button>
                        <button className="px-3 py-2 bg-purple-600 text-white rounded" onClick={()=> applyFormulaToColumn(activeColIdx, schema[activeColIdx].formula || '0')}>Apply</button>
                      </div>
                      <div className="mt-3">
                        <label className="block text-sm text-gray-600 mb-1">Format</label>
                        <select
                          className="w-full px-3 py-2 border rounded"
                          value={schema[activeColIdx].format || (schema[activeColIdx].currency ? 'currency' : 'number')}
                          onChange={async (e)=> {
                            const fmt = e.target.value;
                            const patch = { format: fmt };
                            if (fmt === 'currency' && !schema[activeColIdx].currency) patch.currency = 'USD';
                            await updateColumnMetaAt(activeColIdx, patch);
                          }}
                        >
                          <option value="number">Number</option>
                          <option value="currency">Currency</option>
                          <option value="percent">Percent (%)</option>
                          <option value="decimal_0">Decimal (0)</option>
                          <option value="decimal_1">Decimal (0.0)</option>
                          <option value="decimal_2">Decimal (0.00)</option>
                        </select>
                      </div>
                      {(String(schema[activeColIdx].format || '') === 'currency' || (!schema[activeColIdx].format && schema[activeColIdx].currency)) && (
                        <div className="mt-3">
                          <label className="block text-sm text-gray-600 mb-1">Currency</label>
                          <select
                            className="w-full px-3 py-2 border rounded"
                            value={schema[activeColIdx].currency || 'USD'}
                            onChange={async (e)=> { await updateColumnMetaAt(activeColIdx, { currency: e.target.value || 'USD', format: 'currency' }); }}
                          >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Width (px)</label>
                    <input type="number" min="60" max="600" className="w-full px-3 py-2 border rounded" value={schema[activeColIdx].width || 200} onChange={(e)=> updateColumnWidthAt(activeColIdx, e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Select a column</div>
              )}
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-3">Activity</h3>
              <div className="space-y-3 max-h-64 overflow-auto">
                {activity.length === 0 && <div className="text-sm text-gray-500">No recent activity</div>}
                {activity.map((a, i) => (
                  <div key={i} className="text-sm">
                    <div className="text-gray-900">{a.msg}</div>
                    <div className="text-gray-500 text-xs">{new Date(a.at).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
        <footer id="footer" className="bg-white border-t border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"><i className="fas fa-download"></i>Export</button>
              <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"><i className="fas fa-undo"></i>Undo</button>
            </div>
            <div className="text-sm text-gray-500">
              {saving ? 'Saving...' : `Last saved: just now · Viewers: ${presenceCount}`}
            </div>
          </div>
        </footer>
      </div>
      {/* EXACT SOURCE END */}

      {/* Team Access Modal */}
      {showShare && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={(e)=>{ if (e.target === e.currentTarget) setShowShare(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Team Access</h3>
              <button onClick={()=>setShowShare(false)} className="text-gray-500 hover:text-gray-700"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Add collaborator</label>
                <div className="flex items-center gap-2">
                  <input
                    value={inviteEmail}
                    onChange={(e)=>setInviteEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                  <select value={addingRole} onChange={(e)=>setAddingRole(e.target.value)} className="px-3 py-2 border rounded-lg">
                    <option value="view">View</option>
                    <option value="edit">Edit</option>
                  </select>
                  <button
                    onClick={async ()=>{
                      const email = String(inviteEmail || '').trim();
                      if (!email) { window.alert('Enter an email address'); return; }
                      try {
                        setShareLoading(true);
                        await apiFetch(`${backendBase}/api/tables/${id}/guest-invite`, {
                          method: 'POST',
                          body: JSON.stringify({ email, role: addingRole }),
                        });
                        setInviteEmail('');
                        await loadShareState();
                      } catch (e) {
                        console.error('Failed to invite collaborator', e);
                        window.alert('Failed to invite collaborator. Make sure you are a team admin and the email is not a jobseeker account.');
                      } finally {
                        setShareLoading(false);
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Send Invite
                  </button>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">People with access</div>
                <div className="divide-y border rounded-lg">
                  {(() => {
                    const list = [];
                    // members
                    for (let i = 0; i < (collaborators||[]).length; i++) {
                      const c = (collaborators||[])[i];
                    const member = teamMembers.find(m => String(m.id) === String(c.user_id));
                      const external = collabProfiles[String(c.user_id)];
                      const display = member?.full_name || (member ? [member.first_name, member.last_name].filter(Boolean).join(' ') : '') || external?.name || member?.email || external?.email || c.user_id;
                      const email = member?.email || external?.email || '';
                      list.push(
                        <div key={`member-${c.user_id}-${i}`} className="flex items-center justify-between p-3">
                          <div className="min-w-0">
                            <div className="text-gray-900 font-medium truncate">{display}</div>
                            <div className="text-xs text-gray-500 truncate">{email}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select value={c.role} onChange={async (e)=>{
                              const val = e.target.value === 'edit' ? 'edit' : 'view';
                              const next = (collaborators||[]).map((x, idx) => idx===i ? { ...x, role: val } : x);
                              setCollaborators(next);
                              try {
                                await apiFetch(`${backendBase}/api/tables/${id}/collaborators`, { method: 'POST', body: JSON.stringify({ collaborators: next }) });
                                await loadShareState();
                              } catch {}
                            }} className="px-2 py-1 border rounded">
                              <option value="view">View</option>
                              <option value="edit">Edit</option>
                            </select>
                            <button onClick={async ()=>{
                              const next = (collaborators||[]).filter((_, idx)=> idx!==i);
                              setCollaborators(next);
                              try {
                                await apiFetch(`${backendBase}/api/tables/${id}/collaborators`, { method: 'POST', body: JSON.stringify({ collaborators: next }) });
                                await loadShareState();
                              } catch {}
                            }} className="text-gray-500 hover:text-red-600 p-2"><i className="fas fa-trash"></i></button>
                          </div>
                        </div>
                      );
                    }
                    // Guests are shown from loadShareState via backend (not stored in collaborators[])
                    // We'll show them in a separate block below using a simple fetch.
                    return list;
                  })()}
                  {(!collaborators || collaborators.length === 0) && <div className="p-3 text-sm text-gray-500">No collaborators yet.</div>}
                </div>
                {guestInvites.length > 0 && (
                  <div className="mt-3 border rounded-lg divide-y">
                    <div className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50">Pending invites</div>
                    {guestInvites.map((g, idx)=>(
                      <div key={`${g.email}-${idx}`} className="flex items-center justify-between p-3">
                        <div className="min-w-0">
                          <div className="text-gray-900 font-medium truncate">{g.email}</div>
                          <div className="text-xs text-gray-500 truncate">{g.status === 'accepted' ? 'Accepted' : 'Pending'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={g.role}
                            onChange={async (e)=>{
                              const role = e.target.value === 'edit' ? 'edit' : 'view';
                              setGuestInvites(prev => prev.map((x,i)=> i===idx ? { ...x, role } : x));
                              try {
                                await apiFetch(`${backendBase}/api/tables/${id}/guest-invite`, { method:'POST', body: JSON.stringify({ email: g.email, role }) });
                                await loadShareState();
                              } catch {}
                            }}
                            className="px-2 py-1 border rounded"
                          >
                            <option value="view">View</option>
                            <option value="edit">Edit</option>
                          </select>
                          <button
                            title="Remove invite"
                            onClick={async ()=>{
                              try {
                                await apiFetch(`${backendBase}/api/tables/${id}/guest-invite?email=${encodeURIComponent(g.email)}`, { method:'DELETE' });
                                await loadShareState();
                              } catch {}
                            }}
                            className="text-gray-500 hover:text-red-600 p-2"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {shareLoading && <div className="mt-2 text-xs text-gray-500">Loading access…</div>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={()=>setShowShare(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={async()=>{
                try {
                  // Member collaborators updates are already persisted on change; no-op save for compatibility.
                  await loadShareState();
                  setShowShare(false);
                } catch (e) {
                  console.error('Failed to save access', e);
                  window.alert('Failed to save access. Make sure you are a team admin and the collaborator is a recruiter user.');
                }
              }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Data Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={(e)=>{ if (e.target === e.currentTarget) setShowImportModal(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Import Data</h3>
              <button onClick={()=>setShowImportModal(false)} className="text-gray-500 hover:text-gray-700"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-purple-900">Upload from CSV</div>
                    <div className="text-xs text-purple-700 mt-0.5">Import rows & columns from a CSV file into this table.</div>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 cursor-pointer">
                    <i className="fas fa-file-csv"></i>
                    Upload CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCsvFile(f); }}
                    />
                  </label>
                </div>
                {csvInfo?.name && (
                  <div className="mt-3 text-xs text-purple-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-1 rounded bg-white/60 border border-purple-200">{csvInfo.name}</span>
                      <span className="px-2 py-1 rounded bg-white/60 border border-purple-200">{csvInfo.cols} columns</span>
                      <span className="px-2 py-1 rounded bg-white/60 border border-purple-200">{csvInfo.rows} rows</span>
                    </div>
                    {csvError && <div className="mt-2 text-red-600">{csvError}</div>}
                    {csvHeaders?.length > 0 && (
                      <div className="mt-2 text-[11px] text-purple-800">
                        Headers: {csvHeaders.slice(0, 8).join(', ')}{csvHeaders.length > 8 ? '…' : ''}
                      </div>
                    )}
                    <label className="mt-2 flex items-center gap-2 text-[12px] text-purple-900">
                      <input type="checkbox" checked={csvReplaceExisting} onChange={(e)=>setCsvReplaceExisting(e.target.checked)} />
                      Replace existing rows (overwrite table data)
                    </label>
                    <div className="mt-3">
                      <button
                        disabled={!csvFile || !csvRows.length}
                        onClick={async ()=>{ await importFromCsv(csvFile); setShowImportModal(false); }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Import CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-400">— or import from an in-app source —</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select value={importSource} onChange={(e)=>setImportSource(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                    <option value="/leads">/leads</option>
                    <option value="/candidates">/candidates</option>
                    <option value="/deals">/deals</option>
                    <option value="/jobs">/jobs</option>
                    <option value="/campaigns">/campaigns</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status (optional)</label>
                  <input value={importFilters.status} onChange={(e)=>setImportFilters(f=>({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. new, open, won" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input type="date" value={importFilters.startDate} onChange={(e)=>setImportFilters(f=>({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                  <input type="date" value={importFilters.endDate} onChange={(e)=>setImportFilters(f=>({ ...f, endDate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max rows</label>
                  <input type="number" min="1" value={importFilters.limit} onChange={(e)=>setImportFilters(f=>({ ...f, limit: Number(e.target.value)||0 }))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <label className="flex items-center gap-2 mt-6 md:mt-7 text-sm">
                  <input type="checkbox" checked={importFilters.importAll} onChange={(e)=>setImportFilters(f=>({ ...f, importAll: e.target.checked }))} />
                  Import all (ignore max rows)
                </label>
              </div>
              <div className="text-xs text-gray-500">Tip: Filters apply to /leads and /candidates using their created_at and status fields. Others use only limit/import-all.</div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={()=>setShowImportModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={async()=>{ await importFrom(importSource, importFilters); setShowImportModal(false); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Column Actions Menu (fixed overlay to avoid table stacking issues) */}
      {columnMenuIdx !== null && schema?.[columnMenuIdx] && columnMenuPos && (
        <div
          ref={menuRef}
          className="fixed z-[9999] w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg"
          style={{ top: `${columnMenuPos.top}px`, left: `${columnMenuPos.left}px` }}
          onClick={(e)=> e.stopPropagation()}
        >
          <div className="py-1">
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              onClick={(e)=>{ 
                e.stopPropagation(); 
                setActiveColIdx(columnMenuIdx); 
                setInlineEditIdx(columnMenuIdx);
                setInlineEditName(schema[columnMenuIdx].name);
                setColumnMenuIdx(null);
                setColumnMenuPos(null);
              }}
            >
              Edit column…
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Change type</div>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              onClick={async (e)=>{ e.stopPropagation(); await changeColumnTypeAt(columnMenuIdx, 'text'); setActiveColIdx(columnMenuIdx); setColumnMenuIdx(null); setColumnMenuPos(null); }}
            >
              Text
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              onClick={async (e)=>{ e.stopPropagation(); await changeColumnTypeAt(columnMenuIdx, 'number'); setActiveColIdx(columnMenuIdx); setColumnMenuIdx(null); setColumnMenuPos(null); }}
            >
              Number
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              onClick={async (e)=>{ 
                e.stopPropagation();
                const cur = (schema[columnMenuIdx] && schema[columnMenuIdx].currency) ? schema[columnMenuIdx].currency : 'USD';
                await changeColumnTypeAt(columnMenuIdx, 'money', cur);
                setActiveColIdx(columnMenuIdx);
                setColumnMenuIdx(null);
                setColumnMenuPos(null);
              }}
            >
              Money
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              onClick={async (e)=>{ e.stopPropagation(); await changeColumnTypeAt(columnMenuIdx, 'date'); setActiveColIdx(columnMenuIdx); setColumnMenuIdx(null); setColumnMenuPos(null); }}
            >
              Date
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              onClick={async (e)=>{ e.stopPropagation(); await changeColumnTypeAt(columnMenuIdx, 'status'); setActiveColIdx(columnMenuIdx); setColumnMenuIdx(null); setColumnMenuPos(null); }}
            >
              Status
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              onClick={async (e)=>{ 
                e.stopPropagation(); 
                const cur = (schema[columnMenuIdx] && schema[columnMenuIdx].currency) ? schema[columnMenuIdx].currency : undefined;
                await changeColumnTypeAt(columnMenuIdx, 'formula', cur);
                setActiveColIdx(columnMenuIdx);
                setColumnMenuIdx(null);
                setColumnMenuPos(null);
                openFormulaBuilder(columnMenuIdx);
              }}
            >
              Formula…
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button
              className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
              onClick={async (e)=>{ 
                e.stopPropagation(); 
                const colName = schema?.[columnMenuIdx]?.name || 'column';
                setColumnMenuIdx(null);
                setColumnMenuPos(null);
                let ok = true;
                try { ok = window.confirm(`Delete column “${colName}”? This cannot be undone.`); } catch {}
                if (ok) { await deleteColumnAt(columnMenuIdx); }
              }}
            >
              Delete column
            </button>
          </div>
        </div>
      )}

      {/* Status Options Modal */}
      {showStatusOptionsModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={(e)=>{ if (e.target === e.currentTarget) closeStatusOptions(); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-semibold text-gray-900">Customize status options</h3>
              <button onClick={closeStatusOptions} className="text-gray-500 hover:text-gray-700"><i className="fas fa-times"></i></button>
            </div>
            <div className="text-sm text-gray-600 mb-4">
              These options will appear in the dropdown for this status column.
            </div>

            <div className="flex gap-2 mb-3">
              <input
                value={statusOptionsInput}
                onChange={(e)=> setStatusOptionsInput(e.target.value)}
                onKeyDown={(e)=> {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = String(statusOptionsInput || '').trim();
                    if (!v) return;
                    const next = normalizeStatusOptions([...(statusOptionsDraft || []), v]);
                    setStatusOptionsDraft(next);
                    setStatusOptionsInput('');
                  }
                }}
                placeholder="Add an option (e.g., Interviewing)"
                className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              />
              <button
                onClick={()=> {
                  const v = String(statusOptionsInput || '').trim();
                  if (!v) return;
                  const next = normalizeStatusOptions([...(statusOptionsDraft || []), v]);
                  setStatusOptionsDraft(next);
                  setStatusOptionsInput('');
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add
              </button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              {(statusOptionsDraft || []).length === 0 ? (
                <div className="px-4 py-4 text-sm text-gray-500">No options yet. Add your first status above.</div>
              ) : (
                <div className="divide-y">
                  {(statusOptionsDraft || []).map((opt, idx) => (
                    <div key={`${opt}_${idx}`} className="px-4 py-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-gray-800 truncate">{opt}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={idx === 0}
                          onClick={()=> {
                            const next = [...(statusOptionsDraft || [])];
                            const tmp = next[idx - 1];
                            next[idx - 1] = next[idx];
                            next[idx] = tmp;
                            setStatusOptionsDraft(next);
                          }}
                          className="px-2 py-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                          title="Move up"
                        >
                          <i className="fas fa-arrow-up"></i>
                        </button>
                        <button
                          disabled={idx === (statusOptionsDraft || []).length - 1}
                          onClick={()=> {
                            const next = [...(statusOptionsDraft || [])];
                            const tmp = next[idx + 1];
                            next[idx + 1] = next[idx];
                            next[idx] = tmp;
                            setStatusOptionsDraft(next);
                          }}
                          className="px-2 py-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                          title="Move down"
                        >
                          <i className="fas fa-arrow-down"></i>
                        </button>
                        <button
                          onClick={()=> setStatusOptionsDraft((statusOptionsDraft || []).filter((_, i) => i !== idx))}
                          className="px-2 py-1 text-red-600 hover:text-red-700"
                          title="Remove"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={()=> setStatusOptionsDraft(normalizeStatusOptions(DEFAULT_STATUS_OPTIONS))}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Reset to defaults
              </button>
              <div className="flex gap-3">
                <button onClick={closeStatusOptions} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button onClick={saveStatusOptions} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette (⌘K) */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-24"
          onClick={(e)=>{ if (e.target === e.currentTarget) { setShowCommandPalette(false); setCommandQuery(''); } }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <i className="fas fa-search text-gray-400"></i>
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(e)=> setCommandQuery(e.target.value)}
                onKeyDown={(e)=> {
                  if (e.key === 'Escape') { e.preventDefault(); setShowCommandPalette(false); setCommandQuery(''); }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const first = (filteredCommands || [])[0];
                    if (first?.run) {
                      setShowCommandPalette(false);
                      setCommandQuery('');
                      try { first.run(); } catch {}
                    }
                  }
                }}
                placeholder="Search actions…"
                className="flex-1 outline-none text-sm py-2 bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
              />
              <div className="text-xs text-gray-400">Esc</div>
            </div>
            <div className="max-h-[360px] overflow-auto">
              {(filteredCommands || []).length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">No matching actions.</div>
              ) : (
                <div className="divide-y">
                  {(filteredCommands || []).slice(0, 12).map((cmd) => (
                    <button
                      key={cmd.id}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between gap-4 text-gray-900 dark:text-gray-100"
                      onClick={() => {
                        setShowCommandPalette(false);
                        setCommandQuery('');
                        try { cmd.run(); } catch {}
                      }}
                    >
                      <div className="text-sm">{cmd.title}</div>
                      {cmd.shortcut ? <div className="text-xs text-gray-500">{cmd.shortcut}</div> : <div className="text-xs text-gray-400"></div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <div>Tip: press <span className="font-medium">Enter</span> to run the first result</div>
              <div className="text-gray-400">⌘K</div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Overlay (?) */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={(e)=>{ if (e.target === e.currentTarget) setShowShortcuts(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Keyboard shortcuts</h3>
              <button onClick={()=>setShowShortcuts(false)} className="text-gray-500 hover:text-gray-700"><i className="fas fa-times"></i></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-xs font-medium text-gray-500 mb-2">GLOBAL</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span>Open command palette</span><span className="text-gray-600">⌘K / Ctrl+K</span></div>
                  <div className="flex items-center justify-between"><span>Show shortcuts</span><span className="text-gray-600">?</span></div>
                  <div className="flex items-center justify-between"><span>Close dialogs / menus</span><span className="text-gray-600">Esc</span></div>
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-xs font-medium text-gray-500 mb-2">ROWS & CELLS</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span>Move selection</span><span className="text-gray-600">← ↑ → ↓</span></div>
                  <div className="flex items-center justify-between"><span>Next / previous cell</span><span className="text-gray-600">Tab / Shift+Tab</span></div>
                  <div className="flex items-center justify-between"><span>Edit selected cell</span><span className="text-gray-600">Enter</span></div>
                  <div className="flex items-center justify-between"><span>Cancel editing</span><span className="text-gray-600">Esc</span></div>
                  <div className="flex items-center justify-between"><span>Add row</span><span className="text-gray-600">⌘Enter / Ctrl+Enter</span></div>
                  <div className="flex items-center justify-between"><span>Delete selected rows</span><span className="text-gray-600">Del</span></div>
                  <div className="flex items-center justify-between"><span>Clear active cell</span><span className="text-gray-600">Del</span></div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Note: Delete/Clear only triggers when you’re not actively typing in an input.
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={()=>setShowShortcuts(false)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Formula Builder Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Build formula</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={()=>setShowFormulaModal(false)}><i className="fas fa-times"></i></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Expression</label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., Monthly * 12"
                  value={formulaExpr}
                  onChange={(e)=>setFormulaExpr(e.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {['+','-','*','/','(',')'].map(op => (
                    <button key={op} className="px-2 py-1 border rounded text-sm" onClick={()=>setFormulaExpr(f=>`${f}${op}`)}>{op}</button>
                  ))}
                  {['SUM','AVG','MIN','MAX','ROUND'].map(fn => (
                    <button key={fn} className="px-2 py-1 border rounded text-sm" title={`${fn}(...)`} onClick={()=>setFormulaExpr(f=> f ? `${f} ${fn}()` : `${fn}()`) }>{fn}</button>
                  ))}
                </div>
                {/* Quick Picks */}
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Quick picks</div>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const numericCols = (schema || []).filter(c => ['number','money','formula'].includes(c?.type));
                      const chips = [];
                      if (numericCols.length) {
                        const label0 = colLabel(numericCols[0]);
                        const v0 = toVarName(label0);
                        chips.push({ label: `${label0} × 12`, expr: `${v0} * 12` });
                      }
                      if (numericCols.length >= 2) {
                        const labelA = colLabel(numericCols[0]);
                        const labelB = colLabel(numericCols[1]);
                        const vA = toVarName(labelA);
                        const vB = toVarName(labelB);
                        chips.push({ label: `${labelA} + ${labelB}`, expr: `${vA} + ${vB}` });
                        chips.push({ label: `${labelA} × ${labelB}`, expr: `${vA} * ${vB}` });
                      }
                      if (numericCols.length >= 2) {
                        const allVars = numericCols.map(c => toVarName(colLabel(c))).join(', ');
                        chips.push({ label: 'SUM(all numeric)', expr: `SUM(${allVars})` });
                        chips.push({ label: 'AVG(all numeric)', expr: `AVG(${allVars})` });
                      }
                      return chips.map((c, i) => (
                        <button key={i} className="px-2 py-1 border rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700 dark:text-gray-100" onClick={()=>setFormulaExpr(c.expr)}>{c.label}</button>
                      ));
                    })()}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Insert columns</label>
                <div className="max-h-48 overflow-auto border rounded p-2 dark:border-gray-700">
                  {schema.map((c, i) => (
                    <button key={i} className="px-2 py-1 mr-2 mb-2 border rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700 dark:text-gray-100" onClick={()=>{
                      const v = toVarName(colLabel(c));
                      setFormulaExpr(f => f ? `${f} ${v}` : v);
                    }}>{toVarName(colLabel(c))}</button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Variables represent column values per row. Example: Monthly * 12. Functions supported: SUM, AVG, MIN, MAX, ROUND.</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button className="px-4 py-2 border rounded" onClick={()=>setShowFormulaModal(false)}>Cancel</button>
              <button className="px-4 py-2 bg-purple-600 text-white rounded" onClick={async()=>{ await applyFormulaToColumn(formulaColIdx, formulaExpr); setShowFormulaModal(false); }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


