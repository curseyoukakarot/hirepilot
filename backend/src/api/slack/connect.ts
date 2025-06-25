import { Request, Response } from 'express';

export default function slackConnect(req: Request, res: Response) {
  const userId = (req.query.user_id as string) || req.query.state as string;
  if (!userId) {
    return res.status(400).json({ error: 'missing user_id' });
  }
  const clientId = process.env.SLACK_CLIENT_ID;
  res.set('Access-Control-Allow-Origin','*');
  const redirect = `${process.env.BACKEND_PUBLIC_URL}/api/slack/callback`;
  const url =
    `https://slack.com/oauth/v2/authorize?client_id=${clientId}` +
    `&scope=chat:write,channels:read` +
    `&user_scope=&state=${userId}` +
    `&redirect_uri=${encodeURIComponent(redirect)}`;
  return res.json({ url });
} 