import dayjs from 'dayjs';

type TimeBucket = 'day' | 'week' | 'month' | 'none' | undefined;

export type Filter = {
  alias?: string;
  columnId: string;
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  value: any;
};

export type SourceSpec = { tableId: string; alias: string };
export type JoinSpec = {
  left: { alias: string; columnId: string };
  right: { alias: string; columnId: string };
  type: 'inner' | 'left';
};

export type ComputeFormulaArgs = {
  formula: string;
  sources: SourceSpec[];
  joins?: JoinSpec[];
  timeBucket?: TimeBucket;
  groupBy?: { alias: string; columnId: string } | undefined;
  filters?: Filter[];
  // Caller provides a loader so this engine stays framework-agnostic
  loadRows: (tableId: string) => Promise<{ rows: any[]; schema?: any }>;
};

type Ref = { func: 'SUM'|'AVG'|'COUNT'|'MIN'|'MAX'; alias: string; column: string; token: string };

const AGG_FUNC = /\\b(SUM|AVG|COUNT|MIN|MAX)\\s*\\(\\s*([A-Za-z_][A-Za-z0-9_]*)\\.([A-Za-z_][A-Za-z0-9_]*)\\s*\\)/g;

function parseRefs(expr: string): Ref[] {
  const refs: Ref[] = [];
  let i = 0;
  expr.replace(AGG_FUNC, (_m, func, alias, column) => {
    const token = `__ref_${i++}`;
    refs.push({ func, alias, column, token } as Ref);
    return '';
  });
  return refs;
}

function applyFilter(rows: any[], f: Filter): any[] {
  return rows.filter(r => {
    const v = r?.[f.columnId];
    switch (f.operator) {
      case 'eq': return v === f.value;
      case 'neq': return v !== f.value;
      case 'in': return Array.isArray(f.value) ? (f.value as any[]).includes(v) : false;
      case 'nin': return Array.isArray(f.value) ? !(f.value as any[]).includes(v) : true;
      case 'gt': return Number(v) > Number(f.value);
      case 'gte': return Number(v) >= Number(f.value);
      case 'lt': return Number(v) < Number(f.value);
      case 'lte': return Number(v) <= Number(f.value);
      case 'contains': return String(v || '').toLowerCase().includes(String(f.value || '').toLowerCase());
      default: return true;
    }
  });
}

function bucketKeyFor(row: any, timeBucket: TimeBucket, dateColumnGuess?: string): string {
  if (!timeBucket || timeBucket === 'none') return 'ALL';
  const dc = dateColumnGuess || Object.keys(row || {}).find(k => /(^|_)(date|created_at|created)$/i.test(k)) || '';
  const d = row?.[dc] ? dayjs(row[dc]) : null;
  if (!d || !d.isValid()) return 'unknown';
  if (timeBucket === 'day') return d.startOf('day').format('YYYY-MM-DD');
  if (timeBucket === 'week') return d.startOf('week').format('YYYY-[W]WW');
  return d.startOf('month').format('YYYY-MM');
}

function aggregate(func: Ref['func'], values: number[]): number {
  const clean = values.filter(v => Number.isFinite(v));
  if (clean.length === 0) return 0;
  switch (func) {
    case 'SUM': return clean.reduce((a, b) => a + b, 0);
    case 'AVG': return clean.reduce((a, b) => a + b, 0) / clean.length;
    case 'COUNT': return clean.length;
    case 'MIN': return Math.min(...clean);
    case 'MAX': return Math.max(...clean);
    default: return 0;
  }
}

// Very small, safe arithmetic evaluator supporting + - * / and parentheses and identifiers (tokens)
function evalArithmetic(expr: string, vars: Record<string, number>): number {
  // Tokenize
  const tokens: string[] = [];
  const re = /\\s+|([0-9]*\\.?[0-9]+)|([A-Za-z_][A-Za-z0-9_]*)|([()+\\-*/])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) {
    if (m[1]) tokens.push(m[1]);
    else if (m[2]) tokens.push(m[2]);
    else if (m[3]) tokens.push(m[3]);
  }
  // Shunting-yard to RPN
  const prec: Record<string, number> = { '+':1, '-':1, '*':2, '/':2 };
  const out: string[] = [];
  const ops: string[] = [];
  for (const t of tokens) {
    if (/^[0-9]/.test(t) || /^[A-Za-z_]/.test(t)) out.push(t);
    else if (t in prec) {
      while (ops.length && ops[ops.length-1] in prec && prec[ops[ops.length-1]] >= prec[t]) out.push(ops.pop() as string);
      ops.push(t);
    } else if (t === '(') ops.push(t);
    else if (t === ')') {
      while (ops.length && ops[ops.length-1] !== '(') out.push(ops.pop() as string);
      ops.pop();
    }
  }
  while (ops.length) out.push(ops.pop() as string);
  // Evaluate RPN
  const st: number[] = [];
  for (const t of out) {
    if (t in prec) {
      const b = st.pop() || 0, a = st.pop() || 0;
      if (t === '+') st.push(a + b);
      else if (t === '-') st.push(a - b);
      else if (t === '*') st.push(a * b);
      else if (t === '/') st.push(b === 0 ? 0 : a / b);
    } else if (/^[A-Za-z_]/.test(t)) {
      st.push(vars[t] ?? 0);
    } else {
      st.push(Number(t));
    }
  }
  return st.pop() ?? 0;
}

export async function computeFormula(args: ComputeFormulaArgs): Promise<
  | { kind: 'metric', value: number }
  | { kind: 'series', points: Array<{ x: string, value: number }> }
> {
  const { formula, sources, joins, timeBucket = 'none', groupBy, filters = [], loadRows } = args;
  if (!formula || !sources?.length) return { kind: 'metric', value: 0 };
  const refs = parseRefs(formula);
  // Load rows per source
  const aliasToRows: Record<string, any[]> = {};
  for (const s of sources) {
    const { rows } = await loadRows(s.tableId);
    aliasToRows[s.alias] = rows || [];
  }
  // Apply filters per alias
  const perAliasFilters: Record<string, Filter[]> = {};
  for (const f of filters) {
    const a = f.alias || sources[0].alias;
    perAliasFilters[a] = perAliasFilters[a] || [];
    perAliasFilters[a].push(f);
  }
  for (const alias of Object.keys(aliasToRows)) {
    const fs = perAliasFilters[alias] || [];
    aliasToRows[alias] = fs.reduce((acc, f) => applyFilter(acc, f), aliasToRows[alias]);
  }
  // Determine buckets
  const allBucketKeys = new Set<string>();
  const aliasBucketed: Record<string, Record<string, any[]>> = {};
  for (const alias of Object.keys(aliasToRows)) {
    const bucketed: Record<string, any[]> = {};
    for (const r of aliasToRows[alias]) {
      const key = bucketKeyFor(r, timeBucket);
      (bucketed[key] = bucketed[key] || []).push(r);
      allBucketKeys.add(key);
    }
    aliasBucketed[alias] = bucketed;
  }
  // For now, perform joins later if required; most formulas like SUM(A)-SUM(B) do not need row-level joins
  // Compute ref values per bucket
  const byBucket: Record<string, Record<string, number>> = {};
  for (const bucket of (allBucketKeys.size ? Array.from(allBucketKeys) : ['ALL'])) {
    const values: Record<string, number> = {};
    for (const ref of refs) {
      const rows = (aliasBucketed[ref.alias]?.[bucket]) || aliasToRows[ref.alias] || [];
      const nums = rows.map(r => Number(r?.[ref.column])).filter(n => Number.isFinite(n));
      values[ref.token] = aggregate(ref.func, nums);
    }
    byBucket[bucket] = values;
  }
  // Build expression with tokens
  let expr = formula.replace(AGG_FUNC, (_m, func, alias, col, _idx) => {
    const found = refs.find(r => r.func === func && r.alias === alias && r.column === col);
    return found ? found.token : '0';
  });
  // If no bucketing, return single metric
  if (!timeBucket || timeBucket === 'none') {
    const v = evalArithmetic(expr, byBucket['ALL'] || {});
    return { kind: 'metric', value: v };
  }
  // Else series by bucket (sorted by time-ish key)
  const points = Array.from(allBucketKeys).sort().map(key => ({
    x: key,
    value: evalArithmetic(expr, byBucket[key] || {})
  }));
  return { kind: 'series', points };
}


