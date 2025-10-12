import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function extractTextFromBuffer(buf: Buffer, mime: string) {
  try {
    if ((mime || '').includes('pdf')) {
      const r = await pdfParse(buf);
      return (r.text || '').trim();
    }
    if ((mime || '').includes('word') || (mime || '').includes('docx')) {
      const r = await mammoth.extractRawText({ buffer: buf });
      return (r.value || '').trim();
    }
  } catch {}
  return buf.toString('utf8');
}


