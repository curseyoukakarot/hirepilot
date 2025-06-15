import { Router, Response } from "express";
import { requireAuth } from './middleware/authMiddleware';
import { ApiRequest } from './types/api';

import getCampaigns from "./api/getCampaigns";
import saveMessage from "./api/saveMessage";
import sendMassMessage from "./api/sendMassMessage";
import saveTemplate from "./api/saveTemplate";
import getTemplates from "./api/getTemplates";
import updateTemplate from "./api/updateTemplate";
import deleteTemplate from "./api/deleteTemplate";
import pipelineStages from "./api/pipelineStages";
import messageRouter from './routers/messageRouter';
import { launchCampaign } from './api/campaigns/launch';
import campaignPerformance from './api/campaignPerformance';
import userPerformance from './api/userPerformance';
import teamRouter from './routes/team';

const router = Router();

export type ApiHandler = (req: ApiRequest, res: Response) => Promise<void>;

// Get campaigns
router.get("/getCampaigns", getCampaigns);

// Add after other routes
router.patch("/updateTemplate/:id", requireAuth, updateTemplate);
router.delete("/deleteTemplate/:id", requireAuth, deleteTemplate);

// Save a message
router.post("/saveMessage", saveMessage);

// Send mass message
router.post("/sendMassMessage", sendMassMessage);

// Save a template
router.post("/saveTemplate", saveTemplate);

// Get templates
router.get("/getTemplates", getTemplates);

// Pipeline stages
router.use("/pipeline-stages", requireAuth, pipelineStages);

// Add this line where other routers are registered
router.use('/message', messageRouter);

// Team management routes
router.use('/team', requireAuth, teamRouter);

router.post('/campaigns/:id/launch', launchCampaign);

// Add campaign performance endpoint
router.get('/campaigns/:id/performance', campaignPerformance);

// Add user performance endpoint
router.get('/users/:id/performance', userPerformance);

// Add alias route for DELETE endpoint
router.delete('/delete/:id', (req, res) => {
  res.redirect(307, `/api/campaigns/${req.params.id}`);
});

export default router;
