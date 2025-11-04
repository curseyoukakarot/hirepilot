import { createSupabaseForRequest, getBearerToken, assertAuth } from '../_utils/supabaseServer';

function toCSV(rows: any[]): string {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => (
    v == null ? '' : String(v).includes(',') || String(v).includes('\n') ? `"${String(v).replace(/"/g,'""')}"` : String(v)
  );
  const lines = [headers.join(',')].concat(rows.map(r => headers.map(h=>escape(r[h])).join(',')));
  return lines.join('\n');
}

export default async function handler(req: any, res: any) {
  try {
    const token = getBearerToken(req);
    assertAuth(token);
    const supabase = createSupabaseForRequest(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { widget_type, format, filters } = body || {};
    if (!widget_type || !format) return res.status(400).json({ error: 'widget_type and format are required' });

    // Re-use widgets endpoint logic via internal call (simple server-side reuse)
    let data: any[] = [];
    switch (widget_type) {
      case 'reply-rate': {
        const { data: rows } = await supabase.from('email_events').select('timestamp,event_type');
        data = rows || [];
        break;
      }
      case 'revenue-forecast': {
        const { data: rows } = await supabase.from('revenue_monthly').select('month,revenue').order('month', { ascending: true });
        data = rows || [];
        break;
      }
      default: {
        const { data: rows } = await supabase.from('source_attribution').select('*');
        data = rows || [];
      }
    }

    if (format === 'json') {
      return res.status(200).json({ data });
    }
    if (format === 'csv') {
      const csv = toCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="HirePilot_${widget_type}_${new Date().toISOString().slice(0,10)}.csv"`);
      return res.status(200).send(csv);
    }
    if (format === 'pdf' || format === 'png') {
      // For server-side rasterization you'd typically use Playwright/Puppeteer.
      // Keeping API shape: let the client render via html2canvas/jspdf.
      return res.status(501).json({ error: 'PDF/PNG export is client-side in this build' });
    }
    return res.status(400).json({ error: 'Unsupported format' });
  } catch (e: any) {
    return res.status(e?.statusCode || 500).json({ error: e?.message || 'Export failed' });
  }
}


