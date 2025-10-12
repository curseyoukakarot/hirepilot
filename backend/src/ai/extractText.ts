export async function extractTextFromBuffer(buf: Buffer, mime: string) {
  try {
    if ((mime || '').includes('pdf')) {
      const mod = await import('pdf-parse');
      const pdfParse = (mod as any).default || (mod as any);
      const r = await pdfParse(buf);
      return (r.text || '').trim();
    }
    if ((mime || '').includes('word') || (mime || '').includes('docx')) {
      const mod = await import('mammoth');
      const mammoth = (mod as any).default || (mod as any);
      const r = await mammoth.extractRawText({ buffer: buf });
      return (r.value || '').trim();
    }
  } catch {}
  return buf.toString('utf8');
}


