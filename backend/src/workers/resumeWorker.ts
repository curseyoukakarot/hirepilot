import { startResumeWorker } from '../queues/resumeQueue';
import { extractTextFromBuffer } from '../ai/extractText';
import { parseResumeAI } from '../ai/parseResumeAI';

startResumeWorker(async (data: any) => {
  const { fileBuffer, mimetype } = data;
  const buf: Buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer?.data || fileBuffer);
  const text = await extractTextFromBuffer(buf, mimetype || 'application/octet-stream');
  const parsed = await parseResumeAI(text);
  return parsed;
});


