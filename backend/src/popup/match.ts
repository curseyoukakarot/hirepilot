import OpenAI from 'openai';
import { CATALOG } from './catalog';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
let cachedEmbeds: Record<string, number[]> | null = null;
let cachedTexts: string[] = [];

function normalize(s: string) { return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim(); }

async function ensureEmbeddings() {
  if (cachedEmbeds) return;
  cachedTexts = CATALOG.map(e => `${e.question} ${e.patterns.join(' ')}`);
  const resp = await openai.embeddings.create({ model:'text-embedding-3-small', input: cachedTexts });
  cachedEmbeds = {};
  resp.data.forEach((d,i)=>{ cachedEmbeds![String(i)] = d.embedding as any; });
}

function cosine(a:number[], b:number[]) { let s=0,na=0,nb=0; for (let i=0;i<a.length;i++){ s+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; } return s/(Math.sqrt(na)*Math.sqrt(nb)); }

export async function matchCatalog(question: string, threshold=0.80) {
  const qn = normalize(question);
  // regex / pattern match
  for (const entry of CATALOG) {
    if (entry.patterns.some(p => qn.includes(normalize(p)))) return { entry, reason:'regex' as const };
  }
  await ensureEmbeddings();
  const qEmbed = (await openai.embeddings.create({ model:'text-embedding-3-small', input: qn })).data[0].embedding as any;
  let best = -1, idx = -1;
  for (let i=0;i<cachedTexts.length;i++) {
    const score = cosine(qEmbed, cachedEmbeds![String(i)] as any);
    if (score > best) { best = score; idx = i; }
  }
  if (best >= threshold && idx >= 0) return { entry: CATALOG[idx], reason:'similarity' as const, score: best };
  return { entry: null, reason:'none' as const };
}


