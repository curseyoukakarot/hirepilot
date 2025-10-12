export async function extractTextFromBuffer(buf: Buffer, mime: string) {
  const m = mime || '';
  try {
    if (m.includes('pdf') || m === 'application/pdf') {
      console.log('[extractor] pdf path; size=', buf.length);
      const mod = await import('pdf-parse');
      const pdfParse = (mod as any).default || (mod as any);
      const r = await pdfParse(buf);
      return (r.text || '').trim();
    }
    if (m.includes('word') || m.includes('docx') || m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('[extractor] docx path; size=', buf.length);
      const mod = await import('mammoth');
      const mammoth = (mod as any).default || (mod as any);
      const r = await mammoth.extractRawText({ buffer: buf });
      return (r.value || '').trim();
    }
  } catch (e) {
    console.warn('[extractor] error, falling back to utf8', (e as any)?.message || e);
  }
  console.log('[extractor] utf8 fallback; size=', buf.length);
  return buf.toString('utf8');
}


