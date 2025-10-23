import { Router } from 'express';
import { perUserRateLimit, idempotencyGuard } from '../../../middleware/rateLimitIdempotency';
import rexOpportunity from './opportunity';

export const rexTools = Router();
rexTools.use(perUserRateLimit({ limitPerMin: 60 }));
rexTools.use(idempotencyGuard);
rexTools.use('/opportunity', rexOpportunity);

export default rexTools;


