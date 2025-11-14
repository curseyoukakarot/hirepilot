import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { evaluate as mathEvaluate } from 'mathjs';

export default function TableEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tableName, setTableName] = useState('Untitled Table');
  const [lastSavedName, setLastSavedName] = useState('Untitled Table');
  const [saving, setSaving] = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);
  const [schema, setSchema] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [showShare, setShowShare] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [addingUserId, setAddingUserId] = useState('');
  const [addingRole, setAddingRole] = useState('view');
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSource, setImportSource] = useState('/leads');
  const [importFilters, setImportFilters] = useState({ status: '', startDate: '', endDate: '', limit: 1000, importAll: false });
  const [columnMenuIdx, setColumnMenuIdx] = useState(null);
  const [editColName, setEditColName] = useState('');
  const [editColType, setEditColType] = useState('text');
  const [selectedRowIdxSet, setSelectedRowIdxSet] = useState(new Set());
  const [editCurrency, setEditCurrency] = useState('USD');
  const [inlineEditIdx, setInlineEditIdx] = useState(null);
  const [inlineEditName, setInlineEditName] = useState('');
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [formulaColIdx, setFormulaColIdx] = useState(null);
  const [formulaExpr, setFormulaExpr] = useState('');
  const [activeColIdx, setActiveColIdx] = useState(0);
  const [activity, setActivity] = useState([]);
  const addActivity = (msg) => setActivity((a)=>[{ msg, at: new Date() }, ...a].slice(0,50));
  const [dragColIdx, setDragColIdx] = useState(null);
  const [resizing, setResizing] = useState(null); // { idx, startX, startW }
  const menuRef = useRef(null);

  const apiFetch = async (url, init = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers = { 'Content-Type': 'application/json', ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const resp = await fetch(url, { ...init, headers, credentials: 'include' });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  };

  const toVarName = (name) => {
    const base = String(name || '').replace(/\W+/g, '_');
    return base.length ? base : 'col';
  };

  const buildScopeForRow = (row) => {
    const varMap = {};
    (schema || []).forEach((c) => { varMap[toVarName(c.name)] = c.name; });
    const scope = {};
    for (const v in varMap) {
      const colName = varMap[v];
      const raw = row?.[colName];
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
        next = { ...next, [c.name]: result };
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
        const { data } = await supabase
          .from('custom_tables')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (data?.name) { setTableName(String(data.name)); setLastSavedName(String(data.name)); }
        const loadedSchema = Array.isArray(data?.schema_json) ? data.schema_json : [];
        const loadedRows = Array.isArray(data?.data_json) ? data.data_json : [];
        setSchema(loadedSchema);
        setRows(recomputeFormulasRows(loadedRows));
        setCollaborators(Array.isArray(data?.collaborators) ? data.collaborators : []);
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
        const isSuper = ['super_admin','superadmin'].includes(roleLc);
        const isTeamAdmin = roleLc === 'team_admin';
        setCanManageAccess(isSuper || isTeamAdmin);
        if (me?.team_id) {
          const { data: members } = await supabase.from('users').select('id, email').eq('team_id', me.team_id);
          setTeamMembers(Array.isArray(members) ? members : []);
        } else {
          setTeamMembers([]);
        }
      } catch { setCanManageAccess(false); }
    })();
  }, []);

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
        const ensure = (arr, name, type) => { if (!arr.some(c => String(c.name) === name)) arr.push({ name, type }); };
        const { data: tableRow } = await supabase
          .from('custom_tables')
          .select('schema_json,data_json')
          .eq('id', targetId)
          .maybeSingle();
        let schemaLocal = Array.isArray(tableRow?.schema_json) ? tableRow.schema_json : [];
        let dataLocal = Array.isArray(tableRow?.data_json) ? tableRow.data_json : [];
        if (src === '/deals' || src === 'deals' || src === '/opportunities' || src === 'opportunities') {
          const lim = Number(filters?.limit) || 1000;
          const { data: opps } = await supabase.from('opportunities').select('title,value,stage,created_at').limit(lim);
          ensure(schemaLocal, 'Deal Title', 'text');
          ensure(schemaLocal, 'Value', 'number');
          ensure(schemaLocal, 'Status', 'status');
          ensure(schemaLocal, 'Created', 'date');
          const list = (opps || []).map(o => ({ 'Deal Title': o?.title || 'Deal', 'Value': Number(o?.value)||0, 'Status': o?.stage || 'Pipeline', 'Created': o?.created_at || null }));
          dataLocal = [...dataLocal, ...list];
        } else if (src === '/jobs' || src === 'jobs') {
          const lim = Number(filters?.limit) || 1000;
          const { data: jobs } = await supabase.from('job_requisitions').select('title,status,candidate_count,created_at').limit(lim);
          ensure(schemaLocal, 'Position', 'text');
          ensure(schemaLocal, 'Candidates', 'number');
          ensure(schemaLocal, 'Status', 'status');
          ensure(schemaLocal, 'Created', 'date');
          const list = (jobs || []).map(j => ({ 'Position': j?.title || 'Job', 'Candidates': Number(j?.candidate_count)||0, 'Status': j?.status || 'Open', 'Created': j?.created_at || null }));
          dataLocal = [...dataLocal, ...list];
        } else if (src === '/leads' || src === 'leads') {
          const lim = filters?.importAll ? 100000 : (Number(filters?.limit) || 2000);
          let q = supabase.from('leads').select('name,email,status,tags,location,source,created_at');
          if (filters?.status) q = q.eq('status', filters.status);
          if (filters?.startDate) q = q.gte('created_at', new Date(filters.startDate).toISOString());
          if (filters?.endDate) q = q.lte('created_at', new Date(filters.endDate).toISOString());
          const { data: leads } = await q.limit(lim);
          const list = (leads || []).map(l => ({ 'Name': l?.name||'', 'Email': l?.email||'', 'Status': l?.status||'', 'Tags': Array.isArray(l?.tags)?l.tags.join(', '):(l?.tags||''), 'Location': l?.location||'', 'Source': l?.source||'' }));
          const keys = Array.from(new Set(list.flatMap(r=>Object.keys(r))));
          keys.forEach(k => { if (!schemaLocal.some(c=>c.name===k)) schemaLocal.push({ name:k, type:'text' }); });
          dataLocal = [...dataLocal, ...list];
        } else if (src === '/candidates' || src === 'candidates') {
          const lim = filters?.importAll ? 100000 : (Number(filters?.limit) || 2000);
          let q = supabase.from('candidates').select('name,email,status,job_assigned,location,source,created_at');
          if (filters?.status) q = q.eq('status', filters.status);
          if (filters?.startDate) q = q.gte('created_at', new Date(filters.startDate).toISOString());
          if (filters?.endDate) q = q.lte('created_at', new Date(filters.endDate).toISOString());
          const { data: cands } = await q.limit(lim);
          const list = (cands || []).map(c => ({ 'Name': c?.name||'', 'Email': c?.email||'', 'Status': c?.status||'', 'Job': c?.job_assigned||'', 'Location': c?.location||'', 'Source': c?.source||'' }));
          const keys = Array.from(new Set(list.flatMap(r=>Object.keys(r))));
          keys.forEach(k => { if (!schemaLocal.some(c=>c.name===k)) schemaLocal.push({ name:k, type:'text' }); });
          dataLocal = [...dataLocal, ...list];
        } else if (src === '/campaigns' || src === 'campaigns') {
          const lim = filters?.importAll ? 100000 : (Number(filters?.limit) || 2000);
          let q = supabase.from('campaigns').select('name,status,leads_count,outreach_sent,reply_rate,conversion_rate,created_at');
          if (filters?.status) q = q.eq('status', filters.status);
          if (filters?.startDate) q = q.gte('created_at', new Date(filters.startDate).toISOString());
          if (filters?.endDate) q = q.lte('created_at', new Date(filters.endDate).toISOString());
          const { data: camps } = await q.limit(lim);
          const list = (camps || []).map(c => ({ 'Name': c?.name||'', 'Status': c?.status||'', 'Leads': Number(c?.leads_count)||0, 'Sent': Number(c?.outreach_sent)||0, 'ReplyRate': Number(c?.reply_rate)||0, 'ConversionRate': Number(c?.conversion_rate)||0, 'Created': c?.created_at || null }));
          const keys = Array.from(new Set(list.flatMap(r=>Object.keys(r))));
          keys.forEach(k => { if (!schemaLocal.some(c=>c.name===k)) schemaLocal.push({ name:k, type:'text' }); });
          dataLocal = [...dataLocal, ...list];
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
        setSchema(Array.isArray(data?.schema_json) ? data.schema_json : []);
        setRows(Array.isArray(data?.data_json) ? data.data_json : []);
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

  const handleAddColumn = async (type) => {
    if (!id) return;
    const existingNames = (schema || []).map((c) => String(c.name || ''));
    let idx = existingNames.length + 1;
    let name = `New Column ${idx}`;
    while (existingNames.includes(name)) { idx += 1; name = `New Column ${idx}`; }
    let newCol = { name, type };
    if (type === 'formula') newCol = { name, type, formula: '=0' };
    if (type === 'money') newCol = { name, type, currency: 'USD' };
    const nextSchema = [...schema, newCol];
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
          const idxInSchema = updatedSchema.findIndex(c => c.name === name);
          if (idxInSchema >= 0) openFormulaBuilder(idxInSchema);
        }
        addActivity(`Added ${type} column`);
      }
    } catch {}
    finally { setSaving(false); setColumnMenuOpen(false); }
  };

  const handleAddRow = async () => {
    if (!id) return;
    const empty = {};
    (schema || []).forEach((c) => { empty[c.name] = c.type === 'number' ? 0 : c.type === 'date' ? null : ''; });
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
    // Normalize by type
    let normalized = value;
    if (col.type === 'number' || col.type === 'money') {
      const num = Number(value);
      normalized = isNaN(num) ? 0 : num;
    }
    const edited = rows.map((r, i) => (i === rowIdx ? { ...r, [col.name]: normalized } : r));
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

  const ensureUniqueColName = (base) => {
    const taken = new Set((schema||[]).map(c => String(c.name)));
    if (!taken.has(base)) return base;
    let i = 2; let candidate = `${base} (${i})`;
    while (taken.has(candidate)) { i += 1; candidate = `${base} (${i})`; }
    return candidate;
  };

  const deleteColumnAt = async (colIdx) => {
    const col = schema[colIdx]; if (!col) return;
    const nextSchema = schema.filter((_, i) => i !== colIdx);
    const nextRows = (rows||[]).map(r => { const { [col.name]: _drop, ...rest } = r || {}; return rest; });
    setSchema(nextSchema); setRows(nextRows); setColumnMenuIdx(null);
    await persistSchemaRows(nextSchema, nextRows);
    addActivity(`Deleted column ${col.name}`);
  };

  const renameColumnAt = async (colIdx, name) => {
    const col = schema[colIdx]; if (!col) return;
    const newName = name && name.trim() ? name.trim() : col.name;
    let final = newName === col.name ? col.name : ensureUniqueColName(newName);
    const nextSchema = schema.map((c, i) => i===colIdx ? { ...c, name: final } : c);
    const nextRows = (rows||[]).map(r => {
      const value = (r||{})[col.name];
      if (final === col.name) return r;
      const { [col.name]: _old, ...rest } = r || {};
      return { ...rest, [final]: value };
    });
    setSchema(nextSchema); setRows(nextRows); setColumnMenuIdx(null);
    await persistSchemaRows(nextSchema, nextRows);
    addActivity(`Renamed column to ${final}`);
  };

  const changeColumnTypeAt = async (colIdx, newType, newCurrency) => {
    const col = schema[colIdx]; if (!col) return;
    const nextSchema = schema.map((c, i) => {
      if (i !== colIdx) return c;
      const updated = { ...c, type: newType };
      if (newType === 'money' || newType === 'formula') {
        updated.currency = newCurrency || c.currency || 'USD';
      } else if (updated.currency) {
        delete updated.currency;
      }
      if (newType === 'formula' && !updated.formula) updated.formula = '=0';
      return updated;
    });
    let nextRows = rows;
    if (newType === 'number' || newType === 'money') {
      nextRows = (rows || []).map(r => ({ ...r, [col.name]: Number((r || {})[col.name]) || 0 }));
    }
    nextRows = recomputeFormulasRows(nextRows);
    setSchema(nextSchema); setRows(nextRows); setColumnMenuIdx(null);
    await persistSchemaRows(nextSchema, nextRows);
    addActivity(`Changed column type to ${newType}`);
  };

  // Close column menu on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      try {
        if (!menuRef.current) {
          setColumnMenuIdx(null);
          return;
        }
        if (!menuRef.current.contains(e.target)) {
          setColumnMenuIdx(null);
        }
      } catch {
        setColumnMenuIdx(null);
      }
    };
    if (columnMenuIdx !== null) {
      document.addEventListener('click', onDocClick);
    }
    return () => {
      document.removeEventListener('click', onDocClick);
    };
  }, [columnMenuIdx]);

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
    const count = selectedRowIdxSet.size;
    let proceed = true;
    try { proceed = window.confirm(`Delete ${count} selected row${count > 1 ? 's' : ''}? This cannot be undone.`); } catch {}
    if (!proceed) return;
    const next = (rows || []).filter((_, i) => !selectedRowIdxSet.has(i));
    setRows(next); setSelectedRowIdxSet(new Set());
    await persistRows(next);
    addActivity(`Deleted ${count} row${count>1?'s':''}`);
  };

  const renderEditableCell = (row, col, rowIdx) => {
    const val = row?.[col.name] ?? '';
    const common = {
      className: "w-full bg-transparent border-none outline-none focus:bg-white dark:focus:bg-gray-800 focus:border focus:border-purple-300 dark:focus:border-gray-600 rounded px-2 py-1 dark:text-gray-200 dark:placeholder-gray-400",
      onBlur: () => persistRows(rows),
    };
    const currencySymbol = (cur) => (cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : '$');
    if (col.type === 'number' || col.type === 'money') {
      if (col.type === 'money') {
        return (
          <div className="flex items-center">
            <span className="text-gray-500 mr-1">{currencySymbol(col.currency || 'USD')}</span>
            <input
              type="number"
              step="0.01"
              value={val === '' || val === null ? '' : Number(val)}
              onChange={(e)=> updateCell(rowIdx, col, e.target.value)}
              {...common}
            />
          </div>
        );
      }
      return (
        <input
          type="number"
          step="1"
          value={val === '' || val === null ? '' : Number(val)}
          onChange={(e)=> updateCell(rowIdx, col, e.target.value)}
          {...common}
        />
      );
    }
    if (col.type === 'formula') {
      const n = Number(val) || 0;
      if (col.currency) {
        const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: col.currency || 'USD' });
        return <span className="px-2 py-1 inline-block w-full text-right">{fmt.format(n)}</span>;
      }
      return <span className="px-2 py-1 inline-block w-full text-right">{numberFormatter.format(n)}</span>;
    }
    if (col.type === 'date') {
      const iso = val ? String(val).slice(0,10) : '';
      return (
        <input
          type="date"
          value={iso}
          onChange={(e)=> updateCell(rowIdx, col, e.target.value)}
          {...common}
        />
      );
    }
    if (col.type === 'status') {
      // Build options from existing values + sensible defaults
      const defaults = ['Pipeline','Best Case','Commit','Close Won','Closed Lost','Open','Draft','Hired'];
      const existing = Array.from(new Set((rows||[]).map(r => String((r||{})[col.name] ?? '')).filter(Boolean)));
      const options = Array.from(new Set([...existing, ...defaults]));
      return (
        <select
          value={String(val)}
          onChange={(e)=> updateCell(rowIdx, col, e.target.value)}
          className="w-full bg-transparent border-none outline-none focus:bg-white dark:focus:bg-gray-800 focus:border focus:border-purple-300 dark:focus:border-gray-600 rounded px-2 py-1 dark:text-gray-200"
          onBlur={() => persistRows(rows)}
        >
          <option value=""></option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    // status/text/formula fallback to text edit
    return (
      <input
        type="text"
        value={String(val)}
        onChange={(e)=> updateCell(rowIdx, col, e.target.value)}
        {...common}
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
          const raw = r?.[c.name];
          let n = 0;
          if (c.type === 'money') n = Number(String(raw ?? '').replace(/[^0-9.-]/g, '')) || 0;
          else n = Number(raw) || 0;
          sum += isNaN(n) ? 0 : n;
        }
        acc[c.name] = sum;
      }
    }
    return acc;
  }, [rows, schema]);

  const updateColumnWidthAt = async (colIdx, widthPx) => {
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
                  className="pl-7 pr-3 text-2xl font-semibold text-gray-900 bg-gray-50 border border-transparent outline-none focus:bg-white focus:border-purple-300 rounded px-2 py-1 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { if (canManageAccess) setShowShare(true); else window.alert('Only team admins can manage access'); }} className="px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-60" disabled={!canManageAccess}>
                <i className="fas fa-share-alt mr-2"></i>Share
              </button>
              <button onClick={onSave} disabled={saving} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-70">
                <i className="fas fa-save mr-2"></i>{saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </header>
        <div id="toolbar" className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button id="add-column-btn" onClick={() => setColumnMenuOpen(v=>!v)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <i className="fas fa-plus text-sm"></i>
                Add Column
                <i className="fas fa-chevron-down text-xs"></i>
              </button>
              <div id="column-dropdown" className={`${columnMenuOpen ? '' : 'hidden'} absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50`}>
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 mb-2">COLUMN TYPES</div>
                  <div className="space-y-1">
                    <button onClick={()=>handleAddColumn('text')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-font text-gray-400"></i>Text</button>
                    <button onClick={()=>handleAddColumn('status')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-circle text-purple-400"></i>Status</button>
                    <button onClick={()=>handleAddColumn('number')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-hashtag text-gray-400"></i>Number</button>
                    <button onClick={()=>handleAddColumn('money')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-dollar-sign text-green-600"></i>Money</button>
                    <button onClick={()=>handleAddColumn('date')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-calendar text-gray-400"></i>Date</button>
                    <button onClick={()=>handleAddColumn('formula')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-calculator text-gray-400"></i>Formula</button>
                  </div>
                  <div className="border-t mt-2 pt-2">
                    <div className="text-xs font-medium text-gray-500 mb-2">FROM APP SOURCES</div>
                    <button onClick={()=>{ setImportSource('/deals'); setShowImportModal(true); }} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 text-purple-600 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /deals
                    </button>
                    <button onClick={()=>{ setImportSource('/leads'); setShowImportModal(true); }} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 text-purple-600 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /leads
                    </button>
                    <button onClick={()=>{ setImportSource('/candidates'); setShowImportModal(true); }} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 text-purple-600 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /candidates
                    </button>
                    <button onClick={()=>{ setImportSource('/campaigns'); setShowImportModal(true); }} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 text-purple-600 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /campaigns
                    </button>
                    <button onClick={()=>{ setImportSource('/jobs'); setShowImportModal(true); }} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 text-purple-600 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /jobs
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={handleAddRow} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <i className="fas fa-plus text-sm"></i>Add Row
            </button>
            <button onClick={bulkDeleteSelected} disabled={!selectedRowIdxSet.size} className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${selectedRowIdxSet.size ? 'text-red-700 border-red-300 hover:bg-red-50' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}>
              <i className="fas fa-trash"></i>Delete Selected
            </button>
            <button onClick={()=>{ setImportSource('/leads'); setShowImportModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <i className="fas fa-upload text-sm"></i>Import Data
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"><i className="fas fa-filter"></i></button>
              <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"><i className="fas fa-sort"></i></button>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                <i className="fas fa-robot mr-2"></i>Ask REX
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <main id="main-grid" className="flex-1 p-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div id="table-container" className="overflow-x-auto overflow-y-auto touch-pan-x overscroll-x-contain" style={{ height: 'calc(100vh - 200px)', WebkitOverflowScrolling: 'touch' }}>
                <table className="w-max whitespace-nowrap table-auto">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-12 px-4 py-3 text-left"><input type="checkbox" className="rounded border-gray-300" onChange={(e)=>toggleSelectAll(e.target.checked)} checked={selectedRowIdxSet.size>0 && selectedRowIdxSet.size===(rows||[]).length} /></th>
                      {schema.map((col, ci) => (
                        <th
                          key={col.name}
                          className={`px-4 py-3 text-left text-sm font-medium border-r border-gray-300 min-w-40 relative select-none ${activeColIdx===ci?'bg-purple-50/40':''}`}
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
                            <i className="fas fa-grip-vertical text-gray-500 cursor-move" title="Drag to reorder"></i>
                            <button className="ml-1 text-gray-400 hover:text-gray-600" onClick={(e)=>{ e.stopPropagation(); setColumnMenuIdx(columnMenuIdx===ci?null:ci); setEditColName(col.name); setEditColType(col.type); setEditCurrency((col && col.currency) ? col.currency : 'USD'); }}>
                              <i className="fas fa-ellipsis-h"></i>
                            </button>
                          </div>
                          {/* Column actions menu */}
                          {columnMenuIdx === ci && (
                            <div ref={menuRef} className="absolute right-2 top-9 z-50 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
                              <div className="py-1">
                                <button
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                  onClick={(e)=>{ 
                                    e.stopPropagation(); 
                                    setActiveColIdx(ci); 
                                    setInlineEditIdx(ci);
                                    setInlineEditName(col.name);
                                    setColumnMenuIdx(null);
                                  }}
                                >
                                  Edit column…
                                </button>
                                <div className="border-t border-gray-200 my-1"></div>
                                <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-gray-500">Change type</div>
                                <button
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                  onClick={async (e)=>{ e.stopPropagation(); await changeColumnTypeAt(ci, 'text'); setActiveColIdx(ci); setColumnMenuIdx(null); }}
                                >
                                  Text
                                </button>
                                <button
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                  onClick={async (e)=>{ e.stopPropagation(); await changeColumnTypeAt(ci, 'number'); setActiveColIdx(ci); setColumnMenuIdx(null); }}
                                >
                                  Number
                                </button>
                                <button
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                  onClick={async (e)=>{ e.stopPropagation(); await changeColumnTypeAt(ci, 'money', (schema[ci] && schema[ci].currency) ? schema[ci].currency : 'USD'); setActiveColIdx(ci); setColumnMenuIdx(null); }}
                                >
                                  Money
                                </button>
                                <button
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                  onClick={async (e)=>{ e.stopPropagation(); await changeColumnTypeAt(ci, 'date'); setActiveColIdx(ci); setColumnMenuIdx(null); }}
                                >
                                  Date
                                </button>
                                <button
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                  onClick={async (e)=>{ e.stopPropagation(); await changeColumnTypeAt(ci, 'status'); setActiveColIdx(ci); setColumnMenuIdx(null); }}
                                >
                                  Status
                                </button>
                                <button
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                  onClick={async (e)=>{ 
                                    e.stopPropagation(); 
                                    await changeColumnTypeAt(ci, 'formula', (schema[ci] && schema[ci].currency) ? schema[ci].currency : undefined); 
                                    setActiveColIdx(ci); 
                                    setColumnMenuIdx(null); 
                                    openFormulaBuilder(ci);
                                  }}
                                >
                                  Formula…
                                </button>
                                <div className="border-t border-gray-200 my-1"></div>
                                <button
                                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                  onClick={async (e)=>{ 
                                    e.stopPropagation(); 
                                    setColumnMenuIdx(null);
                                    let ok = true;
                                    try { ok = window.confirm(`Delete column “${col.name}”? This cannot be undone.`); } catch {}
                                    if (ok) { await deleteColumnAt(ci); }
                                  }}
                                >
                                  Delete column
                                </button>
                              </div>
                            </div>
                          )}
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
                      <tr key={idx} className={`transition-colors border-b border-gray-300 ${selectedRowIndex === idx ? 'bg-purple-50 dark:bg-gray-800' : 'hover:bg-purple-50 dark:hover:bg-gray-800'}`} onClick={()=>setSelectedRowIndex(idx)}>
                        <td className="px-4 py-3"><input type="checkbox" className="rounded border-gray-300" onChange={(e)=>toggleSelectRow(idx, e.target.checked)} checked={selectedRowIdxSet.has(idx)} /></td>
                        {schema.map((col, ci) => (
                          <td key={`${idx}-${col.name}`} className="px-4 py-3 border-r border-gray-300" style={{ width: col.width ? `${col.width}px` : undefined }} onClick={()=> setActiveColIdx(ci)}>
                            {renderEditableCell(r, col, idx)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-4 py-2 text-right font-semibold text-gray-700">Total</td>
                      {schema.map((col) => (
                        <td key={`total-${col.name}`} className="px-4 py-2 text-right font-semibold text-gray-900 border-r border-gray-300">
                          {['number','money','formula'].includes(col.type)
                            ? ((col.type === 'money' || (col.type==='formula' && col.currency))
                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: (col && col.currency) ? col.currency : 'USD' }).format(Number(totals[col.name] || 0))
                                : numberFormatter.format(Number(totals[col.name] || 0)))
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
                        <label className="block text-sm text-gray-600 mb-1">Currency (optional)</label>
                        <select className="w-full px-3 py-2 border rounded" value={schema[activeColIdx].currency || ''} onChange={(e)=> changeColumnTypeAt(activeColIdx, 'formula', e.target.value || undefined)}>
                          <option value="">None</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                        </select>
                      </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Add teammate</label>
                <div className="flex items-center gap-2">
                  <select value={addingUserId} onChange={(e)=>setAddingUserId(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg">
                    <option value="">Select user</option>
                    {teamMembers.filter(m => !(collaborators||[]).some(c => String(c.user_id) === String(m.id))).map((m)=>(
                      <option key={m.id} value={m.id}>{m.full_name || m.email || m.id}</option>
                    ))}
                  </select>
                  <select value={addingRole} onChange={(e)=>setAddingRole(e.target.value)} className="px-3 py-2 border rounded-lg">
                    <option value="view">View</option>
                    <option value="edit">Edit</option>
                  </select>
                  <button onClick={()=>{
                    if (!addingUserId) return;
                    setCollaborators(prev => [...prev, { user_id: addingUserId, role: addingRole }]);
                    setAddingUserId('');
                  }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Add</button>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">People with access</div>
                <div className="divide-y border rounded-lg">
                  {(collaborators||[]).map((c, i) => {
                    const member = teamMembers.find(m => String(m.id) === String(c.user_id));
                    return (
                      <div key={`${c.user_id}-${i}`} className="flex items-center justify-between p-3">
                        <div className="min-w-0">
                          <div className="text-gray-900 font-medium truncate">{member?.full_name || member?.email || c.user_id}</div>
                          <div className="text-xs text-gray-500 truncate">{member?.email || ''}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select value={c.role} onChange={(e)=>{
                            const val = e.target.value === 'edit' ? 'edit' : 'view';
                            setCollaborators(prev => prev.map((x, idx) => idx===i ? { ...x, role: val } : x));
                          }} className="px-2 py-1 border rounded">
                            <option value="view">View</option>
                            <option value="edit">Edit</option>
                          </select>
                          <button onClick={()=> setCollaborators(prev => prev.filter((_, idx)=> idx!==i))} className="text-gray-500 hover:text-red-600 p-2"><i className="fas fa-trash"></i></button>
                        </div>
                      </div>
                    );
                  })}
                  {(!collaborators || collaborators.length === 0) && <div className="p-3 text-sm text-gray-500">No collaborators yet.</div>}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={()=>setShowShare(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={async()=>{
                try {
                  // Update collaborators directly via Supabase; client enforces team-admin gating
                  await supabase
                    .from('custom_tables')
                    .update({ collaborators, updated_at: new Date().toISOString() })
                    .eq('id', id);
                  setShowShare(false);
                } catch (e) {
                  window.alert('Failed to save access');
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
                        const v0 = toVarName(numericCols[0].name);
                        chips.push({ label: `${numericCols[0].name} × 12`, expr: `${v0} * 12` });
                      }
                      if (numericCols.length >= 2) {
                        const vA = toVarName(numericCols[0].name);
                        const vB = toVarName(numericCols[1].name);
                        chips.push({ label: `${numericCols[0].name} + ${numericCols[1].name}`, expr: `${vA} + ${vB}` });
                        chips.push({ label: `${numericCols[0].name} × ${numericCols[1].name}`, expr: `${vA} * ${vB}` });
                      }
                      if (numericCols.length >= 2) {
                        const allVars = numericCols.map(c => toVarName(c.name)).join(', ');
                        chips.push({ label: 'SUM(all numeric)', expr: `SUM(${allVars})` });
                        chips.push({ label: 'AVG(all numeric)', expr: `AVG(${allVars})` });
                      }
                      return chips.map((c, i) => (
                        <button key={i} className="px-2 py-1 border rounded text-sm hover:bg-gray-50" onClick={()=>setFormulaExpr(c.expr)}>{c.label}</button>
                      ));
                    })()}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Insert columns</label>
                <div className="max-h-48 overflow-auto border rounded p-2">
                  {schema.map((c, i) => (
                    <button key={i} className="px-2 py-1 mr-2 mb-2 border rounded text-sm hover:bg-gray-50" onClick={()=>{
                      const v = toVarName(c.name);
                      setFormulaExpr(f => f ? `${f} ${v}` : v);
                    }}>{toVarName(c.name)}</button>
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


