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

const router = express.Router();

router.use('/agents', agentsRouter);
router.use('/skills', skillsRouter);
router.use('/workspace-settings', workspaceSettingsRouter);
router.use('/goals', goalsRouter);
router.use('/decisions', decisionsRouter);
router.use('/activity', activityRouter);
router.use('/inbox', inboxRouter);
router.use('/calendar', calendarRouter);

export default router;
