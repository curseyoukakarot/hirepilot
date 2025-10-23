import { Router } from 'express';
import { perUserRateLimit, idempotencyGuard } from '../../../middleware/rateLimitIdempotency';
import rexOpportunity from './opportunity';
import rexMessaging from './messaging';
import rexSourcing from './sourcing';
import rexEnrichment from './enrichment';
import rexCRM from './crm';
import rexBilling from './billing';
import rexTeam from './team';
import rexNotifications from './notifications';
import rexSniper from './sniper';

export const rexTools = Router();
rexTools.use(perUserRateLimit({ limitPerMin: 60 }));
rexTools.use(idempotencyGuard);
rexTools.use('/opportunity', rexOpportunity);
rexTools.use('/messaging', rexMessaging);
rexTools.use('/sourcing', rexSourcing);
rexTools.use('/enrichment', rexEnrichment);
rexTools.use('/crm', rexCRM);
rexTools.use('/billing', rexBilling);
rexTools.use('/team', rexTeam);
rexTools.use('/notifications', rexNotifications);
rexTools.use('/sniper', rexSniper);

export default rexTools;


