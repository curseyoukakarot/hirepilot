import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { Response } from 'express';

interface TemplateUpdate {
  name?: string;
  content?: string;
  subject?: string;
  is_active?: boolean;
}

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { templateId } = req.params;
    if (!templateId) {
      res.status(400).json({ error: 'Missing template ID' });
      return;
    }

    const updates: TemplateUpdate = req.body;
    if (!updates || Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    // First verify the template belongs to the user
    const { data: template, error: fetchError } = await supabaseDb
      .from('templates')
      .select('user_id')
      .eq('id', templateId)
      .single();

    if (fetchError) throw fetchError;
    if (!template || template.user_id !== req.user.id) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Update the template
    const { data, error: updateError } = await supabaseDb
      .from('templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .select()
      .single();

    if (updateError) throw updateError;

    const { status, data: responseData } = res as any;
    if (status === 200) {
      res.status(200).json({ template: responseData });
      return;
    }
  } catch (error) {
    console.error('Error updating template:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to update template',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
};

export default handler;
