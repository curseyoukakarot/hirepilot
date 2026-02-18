import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parse as parseCsv } from 'csv-parse/sync';
import * as crypto from 'crypto';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';

type ApiRequest = Request & {
  user?: {
    id?: string;
    role?: string | null;
  };
};

type LedgerRow = {
  id: string;
  date: string;
  description: string;
  type: string;
  status: string;
  account_id: string;
  inbound_cents: number;
  outbound_cents: number;
  net_cents: number;
  event_allocation_id: string | null;
  notes: string | null;
  transfer_group_id: string | null;
  sort_order: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function normalizeRole(value: any): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s-]/g, '_');
}

function toNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toCents(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.round(value * 100);
  const raw = String(value).trim();
  const isWrappedNegative = raw.startsWith('(') && raw.endsWith(')');
  const cleaned = raw.replace(/[(),$\s]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  const signed = isWrappedNegative ? -Math.abs(parsed) : parsed;
  return Math.round(signed * 100);
}

function computeRiskLevel(valueCents: number, safe: number, warning: number): 'safe' | 'warning' | 'danger' {
  if (valueCents >= safe) return 'safe';
  if (valueCents >= warning) return 'warning';
  return 'danger';
}

function normalizeLedgerType(value: any): string {
  const normalized = normalizeRole(value);
  if (['invoice', 'payment', 'expense', 'transfer', 'adjustment'].includes(normalized)) return normalized;
  return 'adjustment';
}

function normalizeLedgerStatus(value: any): string {
  const normalized = normalizeRole(value);
  if (['sent', 'past_due', 'paid', 'hold', 'na'].includes(normalized)) return normalized;
  return 'na';
}

function normalizeImportDate(value: any): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const monthMap: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  // Supports "Jan2", "Jan 2", "Jan-2", "Jan2 2026", "January 2, 2026"
  const shortMonthPattern = /^([A-Za-z]{3,9})[\s\-]*([0-9]{1,2})(?:[,\s\-]+([0-9]{4}))?$/;
  const shortMonthMatch = raw.match(shortMonthPattern);
  if (shortMonthMatch) {
    const monthKey = String(shortMonthMatch[1] || '').toLowerCase();
    const month = monthMap[monthKey];
    const day = Number(shortMonthMatch[2]);
    const year = shortMonthMatch[3] ? Number(shortMonthMatch[3]) : new Date().getUTCFullYear();
    if (month && day >= 1 && day <= 31 && Number.isFinite(year)) {
      const iso = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
      return iso;
    }
  }

  // Excel date serial values (days since 1899-12-30)
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (Number.isFinite(serial) && serial > 1 && serial < 100000) {
      const epoch = Date.UTC(1899, 11, 30);
      const ms = epoch + Math.round(serial) * 24 * 60 * 60 * 1000;
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return null;
}

function getMappedRowValue(source: Record<string, any>, mappingKey: string | null | undefined, fallbackKeys: string[]) {
  if (mappingKey === '') return undefined;
  if (mappingKey && Object.prototype.hasOwnProperty.call(source, mappingKey)) {
    return source[mappingKey];
  }
  for (const key of fallbackKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  }
  return undefined;
}

function compareLedgerOrder(a: LedgerRow, b: LedgerRow): number {
  const byDate = String(a.date).localeCompare(String(b.date));
  if (byDate !== 0) return byDate;
  const aSortNull = a.sort_order === null || a.sort_order === undefined;
  const bSortNull = b.sort_order === null || b.sort_order === undefined;
  if (aSortNull !== bSortNull) return aSortNull ? 1 : -1;
  if (!aSortNull && !bSortNull && a.sort_order !== b.sort_order) return (a.sort_order as number) - (b.sort_order as number);
  return String(a.created_at).localeCompare(String(b.created_at));
}

async function getIgniteBackofficeSettings() {
  const { data } = await supabase
    .from('ignite_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    safe_threshold_cents: toNumber((data as any)?.safe_threshold_cents, 5000000),
    warning_threshold_cents: toNumber((data as any)?.warning_threshold_cents, 1000000),
    danger_threshold_cents: toNumber((data as any)?.danger_threshold_cents, 900000),
    use_net_cash: Boolean((data as any)?.use_net_cash ?? true),
  };
}

function hostAllowedByHeaders(req: Request, expectedHost: string): boolean {
  const origin = String(req.headers.origin || '').toLowerCase();
  const referer = String(req.headers.referer || '').toLowerCase();
  const expected = String(expectedHost || '').toLowerCase();
  if (!expected) return true;
  if (!origin && !referer) return true;
  if (origin.includes('localhost') || referer.includes('localhost')) return true;
  if (origin.includes('127.0.0.1') || referer.includes('127.0.0.1')) return true;
  return origin.includes(expected) || referer.includes(expected);
}

async function requireIgniteBackofficeAccess(req: ApiRequest, res: Response, next: NextFunction) {
  try {
    const expectedHosts = [
      String(process.env.IGNITE_BACKOFFICE_HOSTNAME || '').trim().toLowerCase(),
      String(process.env.IGNITE_BACKOFFCE_HOSTNAME || '').trim().toLowerCase(),
      String(process.env.IGNITE_HOSTNAME || '').trim().toLowerCase(),
      'backoffice.ignitegtm.com',
      'backoffce.ignitegtm.com',
      'clients.ignitegtm.com',
    ].filter(Boolean);
    const hostAllowed = expectedHosts.some((host) => hostAllowedByHeaders(req, host));
    if (!hostAllowed) {
      return res.status(403).json({ error: 'ignite_hostname_forbidden' });
    }

    const userId = String(req.user?.id || '').trim();
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const role = normalizeRole(req.user?.role);
    if (role === 'ignite_admin' || role === 'ignite_team' || role === 'ignite_backoffice') return next();

    const { data, error } = await supabase
      .from('ignite_client_users')
      .select('role,status')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) return res.status(500).json({ error: error.message });
    const memberships = Array.isArray(data) ? data : [];
    const hasAccess = memberships.some((row: any) => {
      const rowRole = normalizeRole(row?.role);
      return rowRole === 'ignite_admin' || rowRole === 'ignite_team' || rowRole === 'ignite_backoffice';
    });
    if (!hasAccess) return res.status(403).json({ error: 'ignite_backoffice_access_denied' });
    return next();
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'ignite_backoffice_access_check_failed' });
  }
}

async function fetchLedgerRows(filters: {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  accountId?: string;
  type?: string;
  search?: string;
  eventTag?: string;
}) {
  let query = supabase
    .from('ignite_ledger_transactions')
    .select('*')
    .order('date', { ascending: true })
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', filters.dateTo);
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.accountId && filters.accountId !== 'all') query = query.eq('account_id', filters.accountId);
  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type);
  if (filters.search) query = query.ilike('description', `%${filters.search}%`);
  if (filters.eventTag) {
    const tag = String(filters.eventTag).trim();
    query = query.eq('event_allocation_id', tag);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = ((data || []) as LedgerRow[]).sort(compareLedgerOrder);
  return rows;
}

function withRunningBalance(rows: LedgerRow[]) {
  let running = 0;
  return rows.map((row) => {
    running += toNumber(row.net_cents, 0);
    return {
      ...row,
      running_balance_cents: running,
    };
  });
}

router.post('/webhooks/zapier/quickbooks/balances', async (req: Request, res: Response) => {
  try {
    const configuredKey = String(process.env.IGNITE_ZAPIER_WEBHOOK_KEY || '').trim();
    if (!configuredKey) return res.status(500).json({ error: 'missing_webhook_key_configuration' });

    const incomingKey = String(req.headers['x-api-key'] || '').trim();
    if (!incomingKey || incomingKey !== configuredKey) return res.status(401).json({ error: 'unauthorized' });

    const accounts = Array.isArray((req.body || {}).accounts) ? (req.body || {}).accounts : [];
    if (!accounts.length) return res.status(400).json({ error: 'accounts_required' });

    const upserts = accounts.map((entry: any) => {
      const type = normalizeRole(entry?.type);
      const name = String(entry?.name || type || 'Account').trim();
      const balance = toCents(entry?.balance ?? 0);
      const asOf = entry?.asOf ? new Date(String(entry.asOf)).toISOString() : new Date().toISOString();
      return {
        name,
        type: type === 'credit' ? 'credit' : type === 'savings' ? 'savings' : 'operating',
        current_balance_cents: balance,
        currency: 'USD',
        sync_source: 'zapier',
        last_synced_at: asOf,
      };
    });

    const { error } = await supabase.from('ignite_accounts').upsert(upserts as any, {
      onConflict: 'type,name',
    } as any);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ ok: true, synced_accounts: upserts.length });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_sync_quickbooks_balances' });
  }
});

router.use(requireAuthUnified as any);
router.use(requireIgniteBackofficeAccess as any);

router.get('/dashboard', async (_req: ApiRequest, res: Response) => {
  try {
    const settings = await getIgniteBackofficeSettings();

    const [accountsRes, ledgerRes, allocationsRes] = await Promise.all([
      supabase.from('ignite_accounts').select('*'),
      supabase
        .from('ignite_ledger_transactions')
        .select('*')
        .order('date', { ascending: true })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
      supabase
        .from('ignite_event_allocations')
        .select('*')
        .in('status', ['planned', 'active'])
        .order('event_date', { ascending: true, nullsFirst: false }),
    ]);

    if (accountsRes.error) return res.status(500).json({ error: accountsRes.error.message });
    if (ledgerRes.error) return res.status(500).json({ error: ledgerRes.error.message });
    if (allocationsRes.error) return res.status(500).json({ error: allocationsRes.error.message });

    const accounts = accountsRes.data || [];
    const ledgerRows = ((ledgerRes.data || []) as LedgerRow[]).sort(compareLedgerOrder);
    const allocations = allocationsRes.data || [];

    const operatingBalance = accounts
      .filter((row: any) => normalizeRole(row.type) === 'operating')
      .reduce((sum: number, row: any) => sum + toNumber(row.current_balance_cents, 0), 0);
    const savingsBalance = accounts
      .filter((row: any) => normalizeRole(row.type) === 'savings')
      .reduce((sum: number, row: any) => sum + toNumber(row.current_balance_cents, 0), 0);
    const creditBalance = accounts
      .filter((row: any) => normalizeRole(row.type) === 'credit')
      .reduce((sum: number, row: any) => sum + toNumber(row.current_balance_cents, 0), 0);

    const totalHeldCents = allocations.reduce((sum: number, row: any) => {
      const autoHeld = row?.auto_hold_mode ? toNumber(row?.forecast_costs_remaining_cents, 0) : toNumber(row?.held_amount_cents, 0);
      return sum + autoHeld;
    }, 0);

    const netCashCents = operatingBalance + savingsBalance - creditBalance;
    const operatingAvailableCents = operatingBalance - totalHeldCents;

    let running = 0;
    const timelineMap = new Map<string, number>();
    for (const row of ledgerRows) {
      running += toNumber((row as any).net_cents, 0);
      timelineMap.set(String(row.date), running);
    }
    const cashTimeline = Array.from(timelineMap.entries()).map(([date, balance]) => ({
      date,
      balance_cents: balance,
      risk_level: computeRiskLevel(balance, settings.safe_threshold_cents, settings.warning_threshold_cents),
    }));

    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const horizonDate = horizon.toISOString().slice(0, 10);
    const futureBalances = cashTimeline
      .filter((row) => row.date <= horizonDate)
      .map((row) => row.balance_cents);
    const forecastLow = futureBalances.length ? Math.min(...futureBalances) : netCashCents;

    const upcomingHolds = ledgerRows
      .filter((row) => row.status === 'hold' || row.status === 'past_due')
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        date: row.date,
        description: row.description,
        outbound_cents: toNumber(row.outbound_cents, 0),
        status: row.status,
      }));

    const activeAllocationsSummary = allocations.slice(0, 10).map((row: any) => {
      const held = row?.auto_hold_mode ? toNumber(row?.forecast_costs_remaining_cents, 0) : toNumber(row?.held_amount_cents, 0);
      return {
        id: row.id,
        client_name: row.client_name,
        event_name: row.event_name,
        status: row.status,
        funding_received_cents: toNumber(row.funding_received_cents, 0),
        held_amount_cents: held,
        expected_margin_cents: toNumber(row.expected_margin_cents, 0),
      };
    });

    return res.json({
      operating_available_cents: operatingAvailableCents,
      total_held_cents: totalHeldCents,
      net_cash_cents: netCashCents,
      forecast_low_30d_cents: forecastLow,
      cash_timeline: cashTimeline,
      upcoming_holds: upcomingHolds,
      active_allocations_summary: activeAllocationsSummary,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_build_dashboard' });
  }
});

router.get('/ledger', async (req: ApiRequest, res: Response) => {
  try {
    const rows = await fetchLedgerRows({
      dateFrom: req.query.date_from ? String(req.query.date_from) : undefined,
      dateTo: req.query.date_to ? String(req.query.date_to) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      accountId: req.query.account_id ? String(req.query.account_id) : undefined,
      type: req.query.type ? String(req.query.type) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      eventTag: req.query.event_tag ? String(req.query.event_tag) : undefined,
    });
    return res.json({ ledger: withRunningBalance(rows) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_ledger' });
  }
});

router.post('/ledger', async (req: ApiRequest, res: Response) => {
  try {
    const body = req.body || {};
    const payload = {
      date: String(body.date || '').slice(0, 10),
      description: String(body.description || ''),
      type: normalizeLedgerType(body.type || 'adjustment'),
      status: normalizeLedgerStatus(body.status || 'na'),
      account_id: String(body.account_id || ''),
      inbound_cents: toNumber(body.inbound_cents, 0),
      outbound_cents: toNumber(body.outbound_cents, 0),
      event_allocation_id: body.event_allocation_id ? String(body.event_allocation_id) : null,
      notes: body.notes ? String(body.notes) : null,
      transfer_group_id: body.transfer_group_id ? String(body.transfer_group_id) : null,
      sort_order: body.sort_order === null || body.sort_order === undefined ? null : toNumber(body.sort_order, 0),
      created_by: req.user?.id ? String(req.user.id) : null,
    };

    if (!payload.date || !payload.account_id) return res.status(400).json({ error: 'date_and_account_id_required' });

    const { data, error } = await supabase.from('ignite_ledger_transactions').insert(payload as any).select('*').maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ transaction: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_ledger_transaction' });
  }
});

router.patch('/ledger/:id', async (req: ApiRequest, res: Response) => {
  try {
    const body = req.body || {};
    const patch: Record<string, any> = {};
    const allowed = [
      'date',
      'description',
      'type',
      'status',
      'account_id',
      'inbound_cents',
      'outbound_cents',
      'event_allocation_id',
      'notes',
      'transfer_group_id',
      'sort_order',
    ];
    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      if (key === 'type') patch[key] = normalizeLedgerType(body[key]);
      else if (key === 'status') patch[key] = normalizeLedgerStatus(body[key]);
      else if (key === 'inbound_cents' || key === 'outbound_cents' || key === 'sort_order') patch[key] = body[key] === null ? null : toNumber(body[key], 0);
      else if (key === 'event_allocation_id' || key === 'transfer_group_id' || key === 'notes') patch[key] = body[key] ? String(body[key]) : null;
      else if (key === 'date') patch[key] = String(body[key] || '').slice(0, 10);
      else patch[key] = body[key];
    }
    const { data, error } = await supabase
      .from('ignite_ledger_transactions')
      .update(patch as any)
      .eq('id', String(req.params.id))
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'transaction_not_found' });
    return res.json({ transaction: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_update_ledger_transaction' });
  }
});

router.delete('/ledger/:id', async (req: ApiRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const { error } = await supabase.from('ignite_ledger_transactions').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_delete_ledger_transaction' });
  }
});

router.post('/ledger/transfer', async (req: ApiRequest, res: Response) => {
  try {
    const body = req.body || {};
    const date = String(body.date || '').slice(0, 10);
    const amount = toNumber(body.amount_cents, 0);
    const fromAccountId = String(body.from_account_id || '');
    const toAccountId = String(body.to_account_id || '');
    const description = String(body.description || 'Transfer');
    if (!date || !fromAccountId || !toAccountId || amount <= 0) {
      return res.status(400).json({ error: 'date_from_to_amount_required' });
    }

    const transferGroupId = crypto.randomUUID();
    const common = {
      date,
      type: 'transfer',
      status: 'paid',
      transfer_group_id: transferGroupId,
      created_by: req.user?.id ? String(req.user.id) : null,
      notes: body.notes ? String(body.notes) : null,
    };

    const rows = [
      {
        ...common,
        description: `${description} (out)`,
        account_id: fromAccountId,
        inbound_cents: 0,
        outbound_cents: amount,
      },
      {
        ...common,
        description: `${description} (in)`,
        account_id: toAccountId,
        inbound_cents: amount,
        outbound_cents: 0,
      },
    ];

    const { data, error } = await supabase.from('ignite_ledger_transactions').insert(rows as any).select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ transfer_group_id: transferGroupId, transactions: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_transfer' });
  }
});

router.get('/allocations', async (_req: ApiRequest, res: Response) => {
  try {
    const settings = await getIgniteBackofficeSettings();
    const { data, error } = await supabase
      .from('ignite_event_allocations')
      .select('*')
      .order('event_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const allocations = (data || []).map((row: any) => {
      const held = row?.auto_hold_mode ? toNumber(row?.forecast_costs_remaining_cents, 0) : toNumber(row?.held_amount_cents, 0);
      const freeCash = toNumber(row?.funding_received_cents, 0) - held;
      return {
        ...row,
        held_amount_cents: held,
        free_cash_contribution_cents: freeCash,
        risk_level: computeRiskLevel(freeCash, settings.safe_threshold_cents, settings.warning_threshold_cents),
      };
    });
    return res.json({ allocations });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_allocations' });
  }
});

router.post('/allocations', async (_req: ApiRequest, res: Response) => {
  try {
    const body = _req.body || {};
    const payload = {
      client_name: String(body.client_name || ''),
      event_name: String(body.event_name || ''),
      event_date: body.event_date ? String(body.event_date).slice(0, 10) : null,
      status: ['planned', 'active', 'completed', 'archived'].includes(normalizeRole(body.status || 'planned'))
        ? normalizeRole(body.status || 'planned')
        : 'planned',
      funding_received_cents: toNumber(body.funding_received_cents, 0),
      costs_paid_to_date_cents: toNumber(body.costs_paid_to_date_cents, 0),
      forecast_costs_remaining_cents: toNumber(body.forecast_costs_remaining_cents, 0),
      expected_margin_cents: toNumber(body.expected_margin_cents, 0),
      held_amount_cents: toNumber(body.held_amount_cents, 0),
      auto_hold_mode: body.auto_hold_mode !== false,
      linked_proposal_id: body.linked_proposal_id ? String(body.linked_proposal_id) : null,
    };
    const { data, error } = await supabase.from('ignite_event_allocations').insert(payload as any).select('*').maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ allocation: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_allocation' });
  }
});

router.patch('/allocations/:id', async (req: ApiRequest, res: Response) => {
  try {
    const body = req.body || {};
    const patch: Record<string, any> = {};
    const allowed = [
      'client_name',
      'event_name',
      'event_date',
      'status',
      'funding_received_cents',
      'costs_paid_to_date_cents',
      'forecast_costs_remaining_cents',
      'expected_margin_cents',
      'held_amount_cents',
      'auto_hold_mode',
      'linked_proposal_id',
    ];
    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      if (key.endsWith('_cents')) patch[key] = toNumber(body[key], 0);
      else if (key === 'status') {
        patch[key] = ['planned', 'active', 'completed', 'archived'].includes(normalizeRole(body[key]))
          ? normalizeRole(body[key])
          : 'planned';
      }
      else if (key === 'event_date') patch[key] = body[key] ? String(body[key]).slice(0, 10) : null;
      else if (key === 'auto_hold_mode') patch[key] = Boolean(body[key]);
      else if (key === 'linked_proposal_id') patch[key] = body[key] ? String(body[key]) : null;
      else patch[key] = body[key];
    }
    const { data, error } = await supabase
      .from('ignite_event_allocations')
      .update(patch as any)
      .eq('id', String(req.params.id))
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'allocation_not_found' });
    return res.json({ allocation: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_update_allocation' });
  }
});

router.delete('/allocations/:id', async (req: ApiRequest, res: Response) => {
  try {
    const { error } = await supabase.from('ignite_event_allocations').delete().eq('id', String(req.params.id));
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_delete_allocation' });
  }
});

router.post('/allocations/:id/link-ledger', async (req: ApiRequest, res: Response) => {
  try {
    const allocationId = String(req.params.id || '');
    const ledgerIds = Array.isArray((req.body || {}).ledger_transaction_ids) ? (req.body || {}).ledger_transaction_ids : [];
    if (!ledgerIds.length) return res.status(400).json({ error: 'ledger_transaction_ids_required' });
    const { error } = await supabase
      .from('ignite_ledger_transactions')
      .update({ event_allocation_id: allocationId } as any)
      .in('id', ledgerIds.map((id: any) => String(id)));
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, linked_count: ledgerIds.length });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_link_ledger_rows' });
  }
});

router.get('/accounts', async (_req: ApiRequest, res: Response) => {
  try {
    const { data, error } = await supabase.from('ignite_accounts').select('*').order('type', { ascending: true }).order('name', {
      ascending: true,
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ accounts: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_accounts' });
  }
});

router.get('/settings', async (_req: ApiRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('ignite_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });

    if (data) return res.json({ settings: data });

    const fallback = {
      safe_threshold_cents: 5000000,
      warning_threshold_cents: 1000000,
      danger_threshold_cents: 900000,
      use_net_cash: true,
    };
    const { data: inserted, error: insertError } = await supabase
      .from('ignite_settings')
      .insert(fallback as any)
      .select('*')
      .maybeSingle();
    if (insertError) return res.status(500).json({ error: insertError.message });
    return res.json({ settings: inserted || fallback });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_load_settings' });
  }
});

router.patch('/settings', async (req: ApiRequest, res: Response) => {
  try {
    const body = req.body || {};
    const patch: Record<string, any> = {};
    if (Object.prototype.hasOwnProperty.call(body, 'safe_threshold_cents')) {
      patch.safe_threshold_cents = toNumber(body.safe_threshold_cents, 5000000);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'warning_threshold_cents')) {
      patch.warning_threshold_cents = toNumber(body.warning_threshold_cents, 1000000);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'danger_threshold_cents')) {
      patch.danger_threshold_cents = toNumber(body.danger_threshold_cents, 900000);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'use_net_cash')) {
      patch.use_net_cash = Boolean(body.use_net_cash);
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no_settings_to_update' });
    }

    const { data: existing, error: existingError } = await supabase
      .from('ignite_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) return res.status(500).json({ error: existingError.message });

    if (!existing?.id) {
      const { data: inserted, error: insertError } = await supabase
        .from('ignite_settings')
        .insert({
          safe_threshold_cents: toNumber(patch.safe_threshold_cents, 5000000),
          warning_threshold_cents: toNumber(patch.warning_threshold_cents, 1000000),
          danger_threshold_cents: toNumber(patch.danger_threshold_cents, 900000),
          use_net_cash: Object.prototype.hasOwnProperty.call(patch, 'use_net_cash') ? Boolean(patch.use_net_cash) : true,
        } as any)
        .select('*')
        .maybeSingle();
      if (insertError) return res.status(500).json({ error: insertError.message });
      return res.json({ settings: inserted });
    }

    const { data: updated, error: updateError } = await supabase
      .from('ignite_settings')
      .update(patch as any)
      .eq('id', String(existing.id))
      .select('*')
      .maybeSingle();
    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.json({ settings: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_update_settings' });
  }
});

router.patch('/accounts/:id', async (req: ApiRequest, res: Response) => {
  try {
    const body = req.body || {};
    const patch: Record<string, any> = {
      sync_source: 'manual',
    };
    if (Object.prototype.hasOwnProperty.call(body, 'name')) patch.name = String(body.name || '');
    if (Object.prototype.hasOwnProperty.call(body, 'type')) patch.type = normalizeRole(body.type);
    if (Object.prototype.hasOwnProperty.call(body, 'currency')) patch.currency = String(body.currency || 'USD').toUpperCase();
    if (Object.prototype.hasOwnProperty.call(body, 'notes')) patch.notes = body.notes ? String(body.notes) : null;
    if (Object.prototype.hasOwnProperty.call(body, 'last_synced_at')) {
      patch.last_synced_at = body.last_synced_at ? new Date(String(body.last_synced_at)).toISOString() : new Date().toISOString();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'current_balance_cents')) {
      patch.current_balance_cents = toNumber(body.current_balance_cents, 0);
      if (!Object.prototype.hasOwnProperty.call(body, 'last_synced_at')) {
        patch.last_synced_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('ignite_accounts')
      .update(patch as any)
      .eq('id', String(req.params.id))
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'account_not_found' });
    return res.json({ account: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_update_account' });
  }
});

router.post('/accounts/sync', async (req: ApiRequest, res: Response) => {
  try {
    const entries = Array.isArray((req.body || {}).accounts) ? (req.body || {}).accounts : [];
    if (!entries.length) return res.status(400).json({ error: 'accounts_required' });
    const upserts = entries.map((entry: any) => ({
      name: String(entry?.name || normalizeRole(entry?.type) || 'Account'),
      type: normalizeRole(entry?.type || 'operating'),
      current_balance_cents: toNumber(entry?.current_balance_cents, 0),
      currency: String(entry?.currency || 'USD').toUpperCase(),
      last_synced_at: entry?.last_synced_at ? new Date(String(entry.last_synced_at)).toISOString() : new Date().toISOString(),
      sync_source: normalizeRole(entry?.sync_source || 'zapier'),
      notes: entry?.notes ? String(entry.notes) : null,
    }));
    const { error } = await supabase.from('ignite_accounts').upsert(upserts as any, {
      onConflict: 'type,name',
    } as any);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, synced_accounts: upserts.length });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_sync_accounts' });
  }
});

router.post('/imports/upload', upload.single('file'), async (req: ApiRequest, res: Response) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'file_required' });

    const rawText = req.file.buffer.toString('utf-8');
    const records = parseCsv(rawText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;

    const { data: batch, error: batchError } = await supabase
      .from('ignite_import_batches')
      .insert({
        filename: String(req.file.originalname || 'upload.csv'),
        created_by: req.user?.id ? String(req.user.id) : null,
        rows_total: records.length,
        rows_imported: 0,
        status: 'pending',
      } as any)
      .select('*')
      .maybeSingle();
    if (batchError) return res.status(500).json({ error: batchError.message });

    if (records.length > 0) {
      const stagedRows = records.map((row, index) => ({
        batch_id: (batch as any).id,
        row_index: index,
        source_row_json: row,
      }));
      const { error: rowsError } = await supabase.from('ignite_import_rows').insert(stagedRows as any);
      if (rowsError) return res.status(500).json({ error: rowsError.message });
    }

    return res.status(201).json({
      batch: {
        id: (batch as any).id,
        filename: (batch as any).filename,
        rows_total: (batch as any).rows_total,
        status: (batch as any).status,
      },
      preview: records.slice(0, 20),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_upload_import_file' });
  }
});

router.get('/imports', async (_req: ApiRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('ignite_import_batches')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ batches: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_import_batches' });
  }
});

router.post('/imports/:batchId/commit', async (req: ApiRequest, res: Response) => {
  try {
    const batchId = String(req.params.batchId || '');
    const defaultAccountId = req.body?.default_account_id ? String(req.body.default_account_id) : null;
    const mapping = (req.body?.column_mapping || {}) as Record<string, string>;

    const [{ data: batch, error: batchError }, { data: rows, error: rowsError }] = await Promise.all([
      supabase.from('ignite_import_batches').select('*').eq('id', batchId).maybeSingle(),
      supabase.from('ignite_import_rows').select('*').eq('batch_id', batchId).order('row_index', { ascending: true }),
    ]);
    if (batchError) return res.status(500).json({ error: batchError.message });
    if (!batch) return res.status(404).json({ error: 'batch_not_found' });
    if (rowsError) return res.status(500).json({ error: rowsError.message });
    if ((batch as any).status === 'completed') return res.status(400).json({ error: 'batch_already_completed' });

    const accountsRes = await supabase.from('ignite_accounts').select('*').order('created_at', { ascending: true });
    if (accountsRes.error) return res.status(500).json({ error: accountsRes.error.message });
    let accounts = accountsRes.data || [];
    let operating = accounts.find((row: any) => normalizeRole(row.type) === 'operating') || accounts[0];

    // First-time setup safety: if no accounts exist yet, provision a default operating account
    // so imports can proceed without requiring a separate account bootstrap step.
    if (!operating) {
      const { data: insertedAccount, error: insertAccountError } = await supabase
        .from('ignite_accounts')
        .insert({
          name: 'Operating Account',
          type: 'operating',
          current_balance_cents: 0,
          currency: 'USD',
          sync_source: 'manual',
          last_synced_at: new Date().toISOString(),
        } as any)
        .select('*')
        .maybeSingle();
      if (insertAccountError) return res.status(500).json({ error: insertAccountError.message });
      if (insertedAccount) {
        accounts = [insertedAccount as any, ...accounts];
        operating = insertedAccount as any;
      }
    }

    const accountId = defaultAccountId || operating?.id;
    if (!accountId) return res.status(400).json({ error: 'no_account_available_for_import' });

    const rowsToInsert = (rows || []).map((item: any) => {
      const source = (item.source_row_json || {}) as Record<string, any>;
      const dateValue = getMappedRowValue(source, mapping.date, ['date', 'transaction_date']);
      const descriptionValue = getMappedRowValue(source, mapping.description, ['description', 'memo', 'vendor']);
      const typeValue = getMappedRowValue(source, mapping.type, ['type']);
      const statusValue = getMappedRowValue(source, mapping.status, ['status']);
      const inboundValue = getMappedRowValue(source, mapping.inbound, ['inbound', 'in', 'amount_in']);
      const outboundValue = getMappedRowValue(source, mapping.outbound, ['outbound', 'out', 'amount_out']);
      const accountValue = getMappedRowValue(source, mapping.account_id, ['account_id', 'account']);
      const eventValue = getMappedRowValue(source, mapping.event_allocation_id, ['event_allocation_id', 'event']);
      const notesValue = getMappedRowValue(source, mapping.notes, ['notes']);

      // Store both inbound/outbound as positive cents; net is derived as inbound - outbound.
      // CSVs often represent deductions as negative values (e.g. -2000), so normalize here.
      const inbound = Math.abs(toCents(inboundValue ?? 0));
      const outbound = Math.abs(toCents(outboundValue ?? 0));
      const normalizedDate = normalizeImportDate(dateValue) || new Date().toISOString().slice(0, 10);
      const accountToken = String(accountValue || '').trim().toLowerCase();
      const mappedAccount =
        accounts.find((row: any) => String(row.id) === accountToken) ||
        accounts.find((row: any) => String(row.name || '').trim().toLowerCase() === accountToken) ||
        accounts.find((row: any) => normalizeRole(row.type) === normalizeRole(accountToken));

      return {
        date: normalizedDate,
        description: String(descriptionValue || 'Imported transaction'),
        type: normalizeLedgerType(typeValue || 'adjustment'),
        status: normalizeLedgerStatus(statusValue || 'na'),
        account_id: String(mappedAccount?.id || accountId),
        inbound_cents: inbound,
        outbound_cents: outbound,
        event_allocation_id: eventValue ? String(eventValue) : null,
        notes: notesValue ? String(notesValue) : null,
        created_by: req.user?.id ? String(req.user.id) : null,
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from('ignite_ledger_transactions')
      .insert(rowsToInsert as any)
      .select('id');
    if (insertError) {
      await supabase
        .from('ignite_import_batches')
        .update({ status: 'failed' } as any)
        .eq('id', batchId);
      return res.status(500).json({ error: insertError.message });
    }

    const rowPatches = (rows || []).map((row: any, idx: number) => ({
      id: row.id,
      ledger_transaction_id: inserted?.[idx]?.id || null,
    }));
    for (const patch of rowPatches) {
      await supabase
        .from('ignite_import_rows')
        .update({ ledger_transaction_id: patch.ledger_transaction_id } as any)
        .eq('id', patch.id);
    }

    await supabase
      .from('ignite_import_batches')
      .update({
        rows_imported: inserted?.length || 0,
        status: 'completed',
      } as any)
      .eq('id', batchId);

    return res.json({ ok: true, imported: inserted?.length || 0 });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_commit_import_batch' });
  }
});

router.post('/imports/:batchId/rollback', async (_req: ApiRequest, res: Response) => {
  try {
    const batchId = String(_req.params.batchId || '');
    const { data: rows, error: rowsError } = await supabase
      .from('ignite_import_rows')
      .select('ledger_transaction_id')
      .eq('batch_id', batchId);
    if (rowsError) return res.status(500).json({ error: rowsError.message });
    const txIds = (rows || [])
      .map((row: any) => row.ledger_transaction_id)
      .filter((value: any) => !!value)
      .map((value: any) => String(value));

    if (txIds.length) {
      const { error: deleteError } = await supabase.from('ignite_ledger_transactions').delete().in('id', txIds);
      if (deleteError) return res.status(500).json({ error: deleteError.message });
    }

    const { error: batchError } = await supabase
      .from('ignite_import_batches')
      .update({
        status: 'rolled_back',
        rows_imported: 0,
      } as any)
      .eq('id', batchId);
    if (batchError) return res.status(500).json({ error: batchError.message });

    return res.json({ ok: true, rolled_back_transactions: txIds.length });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_rollback_import_batch' });
  }
});

export default router;
