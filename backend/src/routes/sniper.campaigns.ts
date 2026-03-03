import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authMiddleware';
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  listCampaignSteps,
  upsertCampaignSteps,
  enrollProfiles,
  listEnrollments,
  updateEnrollment,
  countEnrollments,
  updateCampaignStats,
  type CampaignStepAction
} from '../services/sniperV1/campaignDb';

type ApiRequest = Request & { user?: { id: string }; teamId?: string };

function getUserId(req: ApiRequest): string | null {
  const uid = (req as any)?.user?.id || (req.headers['x-user-id'] as string | undefined);
  return uid ? String(uid) : null;
}

function getWorkspaceId(req: ApiRequest, userId: string): string {
  const teamId = (req as any).teamId;
  return teamId ? String(teamId) : userId;
}

export const sniperCampaignsRouter = Router();
sniperCampaignsRouter.use(requireAuth as any);

// ─── Zod schemas ────────────────────────────────────────────────────────────

const stepSchema = z.object({
  step_order: z.number().int().min(1).max(50),
  action_type: z.enum(['wait', 'connect', 'message', 'profile_visit', 'like_post']),
  delay_days: z.number().int().min(0).max(90).optional(),
  delay_hours: z.number().int().min(0).max(23).optional(),
  config_json: z.record(z.any()).optional()
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  stop_on_reply: z.boolean().optional(),
  lead_source_json: z.record(z.any()).optional(),
  settings_json: z.record(z.any()).optional(),
  steps: z.array(stepSchema).max(20).optional()
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  stop_on_reply: z.boolean().optional(),
  lead_source_json: z.record(z.any()).optional(),
  settings_json: z.record(z.any()).optional()
});

const stepsPayloadSchema = z.object({
  steps: z.array(stepSchema).max(20)
});

const enrollSchema = z.object({
  profiles: z.array(z.object({
    profile_url: z.string().url().or(z.string().min(5)),
    profile_name: z.string().max(300).optional(),
    profile_json: z.record(z.any()).optional(),
    lead_id: z.string().uuid().optional()
  })).min(1).max(500)
});

const enrollmentPatchSchema = z.object({
  status: z.enum(['active', 'paused']).optional()
});

// ─── Campaigns CRUD ─────────────────────────────────────────────────────────

// POST /campaigns — create campaign (optionally with steps)
sniperCampaignsRouter.post('/', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const campaign = await createCampaign({
      workspace_id: workspaceId,
      created_by: userId,
      name: parsed.data.name,
      description: parsed.data.description,
      stop_on_reply: parsed.data.stop_on_reply,
      lead_source_json: parsed.data.lead_source_json,
      settings_json: parsed.data.settings_json
    });

    // Optionally create steps inline
    let steps: any[] = [];
    if (parsed.data.steps?.length) {
      steps = await upsertCampaignSteps(campaign.id, parsed.data.steps as any);
    }

    return res.status(201).json({ campaign, steps });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_campaign' });
  }
});

// GET /campaigns — list campaigns for workspace
sniperCampaignsRouter.get('/', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const campaigns = await listCampaigns(workspaceId, { status: status as any, limit });
    return res.json(campaigns);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_campaigns' });
  }
});

// GET /campaigns/:id — get single campaign with steps + enrollment counts
sniperCampaignsRouter.get('/:id', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const campaign = await getCampaign(req.params.id);
    if (!campaign || campaign.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'not_found' });
    }

    const steps = await listCampaignSteps(campaign.id);
    const enrollmentCount = await countEnrollments(campaign.id);

    return res.json({ campaign, steps, enrollment_count: enrollmentCount });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_get_campaign' });
  }
});

// PATCH /campaigns/:id — update campaign
sniperCampaignsRouter.patch('/:id', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const existing = await getCampaign(req.params.id);
    if (!existing || existing.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'not_found' });
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const campaign = await updateCampaign(existing.id, parsed.data);
    return res.json({ campaign });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_update_campaign' });
  }
});

// DELETE /campaigns/:id — delete campaign (cascade deletes steps + enrollments)
sniperCampaignsRouter.delete('/:id', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const existing = await getCampaign(req.params.id);
    if (!existing || existing.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'not_found' });
    }
    // Only allow delete if campaign is draft or archived
    if (!['draft', 'archived'].includes(existing.status)) {
      return res.status(409).json({ error: 'campaign_must_be_draft_or_archived_to_delete' });
    }

    await deleteCampaign(existing.id);
    return res.json({ deleted: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_delete_campaign' });
  }
});

// ─── Steps ──────────────────────────────────────────────────────────────────

// GET /campaigns/:id/steps — list steps
sniperCampaignsRouter.get('/:id/steps', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const campaign = await getCampaign(req.params.id);
    if (!campaign || campaign.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'not_found' });
    }

    const steps = await listCampaignSteps(campaign.id);
    return res.json(steps);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_steps' });
  }
});

// PUT /campaigns/:id/steps — replace all steps (upsert)
sniperCampaignsRouter.put('/:id/steps', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const campaign = await getCampaign(req.params.id);
    if (!campaign || campaign.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'not_found' });
    }
    if (campaign.status === 'archived') {
      return res.status(409).json({ error: 'cannot_edit_archived_campaign' });
    }

    const parsed = stepsPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const steps = await upsertCampaignSteps(campaign.id, parsed.data.steps as any);
    return res.json(steps);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_update_steps' });
  }
});

// ─── Enrollments ────────────────────────────────────────────────────────────

// POST /campaigns/:id/enroll — enroll profiles into the campaign
sniperCampaignsRouter.post('/:id/enroll', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const campaign = await getCampaign(req.params.id);
    if (!campaign || campaign.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'not_found' });
    }
    if (!['draft', 'active'].includes(campaign.status)) {
      return res.status(409).json({ error: 'campaign_must_be_draft_or_active_to_enroll' });
    }

    const parsed = enrollSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const enrollments = await enrollProfiles(
      campaign.id,
      workspaceId,
      userId,
      parsed.data.profiles as any
    );

    // Update stats asynchronously
    updateCampaignStats(campaign.id).catch(() => {});

    return res.status(201).json({ enrolled: enrollments.length, enrollments });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_enroll' });
  }
});

// GET /campaigns/:id/enrollments — list enrollments for a campaign
sniperCampaignsRouter.get('/:id/enrollments', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const campaign = await getCampaign(req.params.id);
    if (!campaign || campaign.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'not_found' });
    }

    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const enrollments = await listEnrollments(campaign.id, { status: status as any, limit, offset });
    const totalCount = await countEnrollments(campaign.id, status as any);

    return res.json({ enrollments, total: totalCount });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_enrollments' });
  }
});

// PATCH /campaigns/:id/enrollments/:enrollmentId — pause/resume enrollment
sniperCampaignsRouter.patch('/:id/enrollments/:enrollmentId', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const campaign = await getCampaign(req.params.id);
    if (!campaign || campaign.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'not_found' });
    }

    const parsed = enrollmentPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const enrollment = await updateEnrollment(req.params.enrollmentId, {
      status: parsed.data.status,
      // When resuming, set next_step_at to now so the ticker picks it up
      ...(parsed.data.status === 'active' ? { next_step_at: new Date().toISOString() } : {})
    });

    return res.json({ enrollment });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_update_enrollment' });
  }
});

// ─── Stats ──────────────────────────────────────────────────────────────────

// POST /campaigns/:id/stats/refresh — force refresh stats
sniperCampaignsRouter.post('/:id/stats/refresh', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const campaign = await getCampaign(req.params.id);
    if (!campaign || campaign.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'not_found' });
    }

    await updateCampaignStats(campaign.id);
    const refreshed = await getCampaign(campaign.id);
    return res.json({ stats: refreshed?.stats_json || {} });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_refresh_stats' });
  }
});

export default sniperCampaignsRouter;
