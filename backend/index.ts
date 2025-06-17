import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { EventWebhook } from '@sendgrid/eventwebhook';
import runPhantomRouter from './api/runPhantom';
import phantombusterWebhookRouter from './api/phantombusterWebhook';
import linkedinSaveCookieRouter from './api/linkedinSaveCookie';
import sendgridValidateRouter from './api/sendgridValidate';
console.log('Loaded sendgridValidateRouter:', !!sendgridValidateRouter);

// Load environment variables
dotenv.config();

const app = express();

// 🔍 DEBUG — Watch all incoming requests
app.use((req, _res, next) => {
  console.log('→', req.method, req.originalUrl);
  next();
});

// Enable CORS first, before any routes or body parsers
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://thehirepilot.com',
  allowedHeaders: [
    'Content-Type',
    'Authorization',
  ],
}));

/** ----------------------------------------------------
 *  1)  RAW-BYTES GUARD – must be FIRST middleware
 *      We mount *globally* but only execute for the
 *      exact webhook path.
 * -------------------------------------------------- */
app.use((req, res, next) => {
  if (req.path === '/api/sendgrid/webhook') {
    return express.raw({ type: '*/*', limit: '5mb' })(req, res, next);
  }
  next();
});

/** ----------------------------------------------------
 *  2)  WEBHOOK HANDLER – runs AFTER the guard above,
 *      while req.body is still a Buffer
 * -------------------------------------------------- */
app.post('/api/sendgrid/webhook', (req, res) => {
  console.log(
    'Buffer?', Buffer.isBuffer(req.body),
    'bytes:', (req.body as Buffer).length
  );

  const sig = req.get('x-twilio-email-event-webhook-signature') ?? '';
  const ts  = req.get('x-twilio-email-event-webhook-timestamp') ?? '';

  if (!sig || !ts) {
    res.status(400).send('missing headers');
    return;
  }

  const ew  = new EventWebhook();
  const key = ew.convertPublicKeyToECDSA(process.env.SENDGRID_WEBHOOK_PUB_KEY!.trim());

  if (!ew.verifySignature(key, req.body as Buffer, sig, ts)) {
    res.status(400).send('signature mismatch');
    return;
  }

  res.status(200).end();
});

/** ----------------------------------------------------
 *  3)  GLOBAL JSON / URLENCODED PARSERS – NOW it's safe
 * -------------------------------------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register SendGrid validate router immediately after JSON parser
app.use('/api/sendgrid', sendgridValidateRouter);
console.log('Registered /api/sendgrid/validate route');

/* 3️⃣  Other routes that actually need JSON  */
app.use('/api/phantombuster', runPhantomRouter);
app.use('/api/phantombuster', phantombusterWebhookRouter);
app.use('/api/linkedin', linkedinSaveCookieRouter);
// (example) app.use('/api/users', usersRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// 🔍 DEBUG — list every registered route
function showRoutes(app: import('express').Express) {
  console.log('\n📜 ROUTES LOADED');
  app._router.stack
    .filter((l: any) => l.route)
    .forEach((l: any) => {
      const methods = Object.keys(l.route.methods).join(',').toUpperCase();
      console.log(`${methods.padEnd(7)} ${l.route.path}`);
    });
}
showRoutes(app);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} (process.env.PORT=${process.env.PORT})`);
}); 