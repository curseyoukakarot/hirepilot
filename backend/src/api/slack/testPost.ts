import { Request, Response } from 'express';
import { postToSlack } from '../../lib/slackPoster';

export default async function slackTestPost(req: Request, res: Response) {
  const { userId, text } = req.body as { userId?: string; text?: string };
  if (!userId) return res.status(400).json({ error: 'missing userId' });
  try {
    await postToSlack(userId, text || 'Hello from REX 🎉');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'post error' });
  }
} 