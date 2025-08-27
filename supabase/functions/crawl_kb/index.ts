// supabase/functions/crawl_kb/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

type Page = { url: string; title: string; html: string; text: string };

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SITE_SITEMAP_URLS = (Deno.env.get('SITE_SITEMAP_URLS') || '').split(',').map(s => s.trim()).filter(Boolean);
const MAX_PAGES = Number(Deno.env.get('MAX_PAGES') || '200');

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const resp = await fetch(sitemapUrl);
  if (!resp.ok) throw new Error(`Failed to fetch sitemap: ${sitemapUrl}`);
  const xml = await resp.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  return urls.filter(u => /thehirepilot\.com\//.test(u));
}

function extractMainContent(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || '';
  // Remove scripts/styles/nav/footer
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '');
  // Strip tags
  const text = cleaned
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { title, text };
}

function chunkText(text: string, targetTokens = 900, overlapTokens = 200): string[] {
  // Approximate: 1 token ~ 4 chars for English; adjust as needed
  const targetChars = targetTokens * 4;
  const overlapChars = overlapTokens * 4;
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length && chunks.length < 200) {
    const end = Math.min(text.length, i + targetChars);
    const slice = text.slice(i, end);
    chunks.push(slice.trim());
    if (end >= text.length) break;
    i = end - overlapChars;
    if (i < 0) i = 0;
  }
  return chunks.filter(Boolean);
}

async function embed(texts: string[]): Promise<number[][]> {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Embedding failed: ${t}`);
  }
  const data = await resp.json();
  return data.data.map((d: any: any) => d.embedding);
}

async function upsertKbPagesAndChunks(pages: Page[]) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const headers = { 'Content-Type': 'application/json', 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` };

  // Upsert pages
  for (const p of pages) {
    const { title, html, text, url } = p;
    await fetch(`${supabaseUrl}/rest/v1/rex_kb_pages`, {
      method: 'POST', headers, body: JSON.stringify({ url, title, html, text: null })
    });
    // Update tsvector via RPC to_tsvector
    await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST', headers, body: JSON.stringify({
        q: `update rex_kb_pages set text = to_tsvector('english', ${JSON.stringify(text)}) where url = ${JSON.stringify(url)};`
      })
    });

    // Fetch page id
    const pidResp = await fetch(`${supabaseUrl}/rest/v1/rex_kb_pages?url=eq.${encodeURIComponent(url)}&select=id`, { headers });
    const [row] = await pidResp.json();
    if (!row?.id) continue;

    const chunks = chunkText(text);
    const embeddings = await embed(chunks);
    // Clear existing chunks for this page
    await fetch(`${supabaseUrl}/rest/v1/rex_kb_chunks?page_id=eq.${row.id}`, { method: 'DELETE', headers });
    // Upsert chunks
    const payload = chunks.map((content, idx) => ({ page_id: row.id, ordinal: idx, content, embedding: embeddings[idx] }));
    for (const chunk of payload) {
      await fetch(`${supabaseUrl}/rest/v1/rex_kb_chunks`, { method: 'POST', headers, body: JSON.stringify(chunk) });
    }
  }
}

async function pruneDeleted(existingUrls: string[], currentUrls: string[]) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const headers = { 'Content-Type': 'application/json', 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` };
  const obsolete = existingUrls.filter(u => !currentUrls.includes(u));
  for (const url of obsolete) {
    await fetch(`${supabaseUrl}/rest/v1/rex_kb_pages?url=eq.${encodeURIComponent(url)}`, { method: 'DELETE', headers });
  }
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    // Gather URLs from sitemaps
    const urls = (await Promise.all(SITE_SITEMAP_URLS.map(fetchSitemapUrls))).flat();
    const filtered = urls
      .filter(u => /thehirepilot\.com\//.test(u))
      .filter(u => /(blog|pricing|features|docs|help)/.test(u))
      .slice(0, MAX_PAGES);

    // Fetch existing URLs
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const headers = { 'Content-Type': 'application/json', 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` };
    const existingResp = await fetch(`${supabaseUrl}/rest/v1/rex_kb_pages?select=url`, { headers });
    const existingRows = await existingResp.json();
    const existingUrls = existingRows.map((r: any) => r.url);

    const pages: Page[] = [];
    for (const pageUrl of filtered) {
      const resp = await fetch(pageUrl);
      if (!resp.ok) continue;
      const html = await resp.text();
      const { title, text } = extractMainContent(html);
      if (!text || text.length < 200) continue;
      pages.push({ url: pageUrl, title, html, text });
    }

    await upsertKbPagesAndChunks(pages);
    await pruneDeleted(existingUrls, filtered);

    // Log summary
    await fetch(`${supabaseUrl}/rest/v1/rex_events`, {
      method: 'POST', headers, body: JSON.stringify({ kind: 'kb_sync', payload: { pages: pages.length, urls: filtered.length } })
    });

    return new Response(JSON.stringify({ ok: true, pages: pages.length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});


