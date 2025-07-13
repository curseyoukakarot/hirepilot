import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { Lead } from '../types/lead';

interface UpdateLeadRequest {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  website?: string;
  linkedin?: string;
  status?: Lead['status'];
  source?: string;
  notes?: string;
}

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { leadId } = req.params;
    if (!leadId) {
      res.status(400).json({ error: 'Missing lead ID' });
      return;
    }

    const updateData: UpdateLeadRequest = req.body;
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No update data provided' });
      return;
    }

    // Verify ownership
    const { data: lead, error: fetchError } = await supabaseDb
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError) throw fetchError;
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const { data, error: updateError } = await supabaseDb
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Emit events to both new and legacy systems
    await import('../lib/zapEventEmitter').then(async ({ emitZapEvent, ZAP_EVENT_TYPES, createLeadEventData }) => {
      // Always emit lead updated event
      emitZapEvent({
        userId: req.user!.id,
        eventType: ZAP_EVENT_TYPES.LEAD_UPDATED,
        eventData: createLeadEventData(data, { previous_status: lead.status }),
        sourceTable: 'leads',
        sourceId: data.id
      });

      // If status changed, emit stage changed event
      if (updateData.status && updateData.status !== lead.status) {
        emitZapEvent({
          userId: req.user!.id,
          eventType: ZAP_EVENT_TYPES.LEAD_STAGE_CHANGED,
          eventData: createLeadEventData(data, {
            old_status: lead.status,
            new_status: updateData.status,
          }),
          sourceTable: 'leads',
          sourceId: data.id
        });
      }
    });

    const { status, data: responseData } = res as any;
    if (status === 200) {
      res.status(200).json({ lead: responseData as Lead });
      return;
    }
  } catch (error) {
    console.error('Error updating lead:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to update lead',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
};

export default handler; 