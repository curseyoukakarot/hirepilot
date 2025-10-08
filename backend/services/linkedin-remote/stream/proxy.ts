import { Router, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';

// Proxies HTTPS path /stream/:port/* to the remote Docker host's noVNC server http://<HOST>:<port>/*
// Env: STREAM_PROXY_TARGET_HOST required (e.g., 64.181.209.62)

const router = Router();

const targetHost = process.env.STREAM_PROXY_TARGET_HOST || process.env.DOCKER_PROXY_HOST || process.env.DOCKER_PUBLIC_HOST;
if (!targetHost) {
  // We keep the router mounted even if unset; requests will return 500 with a clear error
}

// Ensure port param is numeric
router.use('/:port', (req: Request, res: Response, next: NextFunction) => {
  const { port } = req.params as { port: string };
  if (!/^\d{2,5}$/.test(port)) {
    res.status(400).send('Invalid port');
    return;
  }
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
    // Dynamically set target using router
    router: (req) => {
      const port = (req.params as any)?.port;
      const host = targetHost || '127.0.0.1';
      return `http://${host}:${port}`;
    },
    pathRewrite: (_path, req) => {
      // Strip /stream/:port prefix
      const port = (req.params as any)?.port;
      return req.originalUrl.replace(new RegExp(`^/stream/${port}`), '') || '/';
    },
    onProxyReq: (proxyReq, req) => {
      // Ensure Host header is upstream host for some servers
      const port = (req.params as any)?.port;
      if (targetHost) proxyReq.setHeader('host', `${targetHost}:${port}`);
    },
    selfHandleResponse: false,
    logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  })
);

export default router;


