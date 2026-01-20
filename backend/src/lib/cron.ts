import parser from 'cron-parser';

export function parseNextRun(cronExpr: string, fromDate: Date = new Date(), tz?: string | null): Date | null {
  try {
    const interval = parser.parseExpression(cronExpr, { currentDate: fromDate, tz: tz || undefined } as any);
    const next = interval.next();
    return new Date(next.toString());
  } catch (e) {
    console.warn('[cron] invalid expression:', cronExpr, (e as any)?.message || e);
    return null;
  }
}


