import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { Lead } from '../types/lead';

interface CreateLeadRequest {
  name: string;
  email: string;
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

    const leadData: CreateLeadRequest = req.body;
    if (!leadData.name || !leadData.email) {
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }

    const { data, error } = await supabaseDb
      .from('leads')
      .insert({
        ...leadData,
        user_id: req.user.id,
        status: leadData.status || 'new'
      })
      .select()
      .single();

    if (error) throw error;

    // Emit events to both new and legacy systems
    await import('../lib/zapEventEmitter').then(({ emitZapEvent, ZAP_EVENT_TYPES, createLeadEventData }) => {
      emitZapEvent({
        userId: req.user!.id,
        eventType: ZAP_EVENT_TYPES.LEAD_CREATED,
        eventData: createLeadEventData(data),
        sourceTable: 'leads',
        sourceId: data.id
      });
    });

    res.status(201).json({ lead: data as Lead });
    return;
  } catch (error) {
    console.error('Error creating lead:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to create lead',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
    return;
  }
};

export default handler; 