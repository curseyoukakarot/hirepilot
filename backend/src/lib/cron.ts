import parser from 'cron-parser';

export function parseNextRun(cronExpr: string, fromDate: Date = new Date()): Date | null {
  try {
    const interval = parser.parseExpression(cronExpr, { currentDate: fromDate });
    const next = interval.next();
    return new Date(next.toString());
  } catch (e) {
    console.warn('[cron] invalid expression:', cronExpr, (e as any)?.message || e);
    return null;
  }
}


