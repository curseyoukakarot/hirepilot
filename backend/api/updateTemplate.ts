import { ApiRequest, ApiResponse, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';

interface TemplateUpdate {
  name?: string;
  content?: string;
  subject?: string;
  is_active?: boolean;
}

const handler: ApiHandler = async (req: ApiRequest, res: ApiResponse) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { templateId } = req.params;
    if (!templateId) {
      return res.status(400).json({ error: 'Missing template ID' });
    }

    const updates: TemplateUpdate = req.body;
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    // First verify the template belongs to the user
    const { data: template, error: fetchError } = await supabaseDb
      .from('templates')
      .select('user_id')
      .eq('id', templateId)
      .single();

    if (fetchError) throw fetchError;
    if (!template || template.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Template not found' });
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

    const result = res as any;
    if (result.status === 200) {
      return res.status(200).json({ template: data });
    }
  } catch (error) {
    console.error('Error updating template:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to update template',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    return res.status(500).json(errorResponse);
  }
};

export default handler;
