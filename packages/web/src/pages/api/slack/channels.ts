type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: any) => ApiResponse;
  setHeader: (name: string, value: string | string[]) => void;
  send: (body: any) => void;
};

const DEFAULT_API_BASE = 'https://api.thehirepilot.com';

const getApiBase = () => {
  const fromEnv =
    process.env.HIREPILOT_API_BASE ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL;
  return (fromEnv || DEFAULT_API_BASE).replace(/\/$/, '');
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const upstreamUrl = `${getApiBase()}/api/slack/channels`;

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const authHeader = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    const cookieHeader = Array.isArray(req.headers.cookie) ? req.headers.cookie.join('; ') : req.headers.cookie;
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers,
    });

    const responseText = await upstreamResponse.text();
    upstreamResponse.headers.forEach((value, key) => {
      if (['content-length', 'content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        return;
      }
      res.setHeader(key, value);
    });
    res.status(upstreamResponse.status).send(responseText);
  } catch (error) {
    console.error('[Sandbox] Slack channel proxy failed', error);
    res.status(500).json({ error: 'Failed to fetch Slack channels' });
  }
}

