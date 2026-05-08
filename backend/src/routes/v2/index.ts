/**
 * v2 — single mount point for all /api/v2/* routes.
 * Mount once in server.ts with: app.use('/api/v2', v2Router)
 */

import express from 'express';
import agentsRouter from './agents';
import skillsRouter from './skills';
import workspaceSettingsRouter from './workspaceSettings';
import goalsRouter from './goals';
import decisionsRouter from './decisions';
import activityRouter from './activity';
import inboxRouter from './inbox';
import calendarRouter from './calendar';
import billingRouter from './billing';
import uiPreferenceRouter from './uiPreference';

const router = express.Router();

router.use('/agents', agentsRouter);
router.use('/skills', skillsRouter);
router.use('/workspace-settings', workspaceSettingsRouter);
router.use('/goals', goalsRouter);
router.use('/decisions', decisionsRouter);
router.use('/activity', activityRouter);
router.use('/inbox', inboxRouter);
router.use('/calendar', calendarRouter);
router.use('/billing', billingRouter);
router.use('/ui-preference', uiPreferenceRouter);

export default router;
