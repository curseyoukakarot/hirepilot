import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import billingRoutes from './routes/billing';
import stripeWebhookRoutes from './routes/stripe-webhook';
import creditsRouter from './routes/credits';
import teamRouter from './routes/team';
import promotionsRouter from './routes/promotions';

const app = express();

// Configure CORS
const allowedOrigins = [];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
} else {
  allowedOrigins.push('https://thehirepilot.com');
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Parse raw body for Stripe webhooks
app.use('/api/stripe/webhook', bodyParser.raw({ type: 'application/json' }));

// Parse JSON bodies for all other routes (increase limit for bulk operations)
app.use(bodyParser.json({ limit: '25mb' }));
// Parse URL-encoded bodies as well with increased limit
app.use(bodyParser.urlencoded({ limit: '25mb', extended: true }));

// Register routes
app.use('/api/billing', billingRoutes);
app.use('/api/stripe/webhook', stripeWebhookRoutes);
app.use('/api/credits', creditsRouter);
app.use('/api/team', teamRouter);
app.use('/api/promotions', promotionsRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

export default app; 