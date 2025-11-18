import { openai } from '../../ai/openaiClient';

export type AnalyticsSeries = {
  id: string;
  label: string;
  values: Array<{ x: string | Date; value: number }>;
  format?: 'currency' | 'number' | 'percent';
};

export type AnalyticsKPI = {
  id: string;
  label: string;
  value: number;
  previousValue?: number | null;
  format?: 'currency' | 'number' | 'percent';
};

export type AnalyticsSnapshot = {
  dashboardId?: string;
  widgetId?: string;
  title: string;
  description?: string;
  timeRange?: { from: string; to: string };
  kpis: AnalyticsKPI[];
  series: AnalyticsSeries[];
  segments?: Array<{ label: string; kpis: AnalyticsKPI[] }>;
  meta?: Record<string, any>;
};

export async function generateAnalyticsInsights(snapshot: AnalyticsSnapshot, userQuestion?: string) {
  const sys = `You are REX, an AI analytics copilot inside HirePilot.
You analyze recruiting, sales, and financial metrics for agencies and recruiters.
You receive structured JSON data representing dashboards and charts, and optional user questions.
Explain what the data shows, highlight significant changes and anomalies, and offer practical, concrete recommendations.
Respond in strict JSON: {"summary":"...","bullet_insights":["..."],"suggestions":["..."]}`;
  const content = [
    { type: 'text', text: 'Snapshot JSON:' },
    { type: 'text', text: JSON.stringify(snapshot).slice(0, 40000) },
    ...(userQuestion ? [{ type: 'text', text: `User question: ${userQuestion}` }] as any[] : [])
  ];
  try {
    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_INSIGHTS_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: sys as any },
        { role: 'user', content: content as any }
      ]
    } as any);
    const raw = resp.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(raw as string); } catch { parsed = {}; }
    return {
      summary: String(parsed.summary || '').slice(0, 1200),
      bulletInsights: Array.isArray(parsed.bullet_insights) ? parsed.bullet_insights.slice(0, 12) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 12) : [],
      rawModelResponse: raw
    };
  } catch (e: any) {
    return {
      summary: 'Unable to generate insights at this time.',
      bulletInsights: [],
      suggestions: [],
      rawModelResponse: { error: e?.message || 'failed' }
    };
  }
}


