import { Router, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';

// Proxies HTTPS path /stream/:port/* to the remote Docker host's noVNC server http://<HOST>:<port>/*
// Env: STREAM_PROXY_TARGET_HOST required (e.g., 64.181.209.62)

const router = Router();

const targetHost = process.env.STREAM_PROXY_TARGET_HOST || process.env.DOCKER_PROXY_HOST || process.env.DOCKER_PUBLIC_HOST;
if (!targetHost) {
  // We keep the router mounted even if unset; requests will return 500 with a clear error
}

// CDP websocket reverse-proxy FIRST: /stream/cdp/:port/* → http://<HOST>:<port>/*
router.use('/cdp/:port', (req: Request, res: Response, next: NextFunction) => {
  const { port } = req.params as { port: string };
  if (!/^\d{2,5}$/.test(port)) return res.status(400).send('Invalid port');
  next();
});

router.use(
  '/cdp/:port',
  createProxyMiddleware({
    target: 'http://placeholder',
    changeOrigin: true,
    ws: true,
    secure: false,
    router: (req) => {
      const port = (req.params as any)?.port;
      const host = targetHost || '127.0.0.1';
      return `http://${host}:${port}`;
    },
    pathRewrite: (_path, req) => {
      const port = (req.params as any)?.port;
      return req.originalUrl.replace(new RegExp(`^/stream/cdp/${port}`), '') || '/';
    },
    onProxyReq: (proxyReq, req) => {
      const port = (req.params as any)?.port;
      if (targetHost) proxyReq.setHeader('host', `${targetHost}:${port}`);
    },
    selfHandleResponse: false,
    logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  })
);

// Ensure generic port param is numeric (after CDP route so it doesn't capture '/cdp')
router.use('/:port', (req: Request, res: Response, next: NextFunction) => {
  const { port } = req.params as { port: string };
  if (!/^\d{2,5}$/.test(port)) return res.status(400).send('Invalid port');
  next();
});

// Default /stream/:port → /vnc.html
router.get('/:port', (req, res, next) => {
  (req as any).url = `${req.url.replace(/\/$/, '')}/vnc.html`;
  next();
});

router.use(
  '/:port',
  createProxyMiddleware({
    target: 'http://placeholder',
    changeOrigin: true,
    ws: true,
    secure: false,
    router: (req) => {
      const port = (req.params as any)?.port;
      const host = targetHost || '127.0.0.1';
      return `http://${host}:${port}`;
    },
    pathRewrite: (_path, req) => {
      const port = (req.params as any)?.port;
      return req.originalUrl.replace(new RegExp(`^/stream/${port}`), '') || '/';
    },
    onProxyReq: (proxyReq, req) => {
      const port = (req.params as any)?.port;
      if (targetHost) proxyReq.setHeader('host', `${targetHost}:${port}`);
    },
    selfHandleResponse: false,
    logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  })
);

export default router;


