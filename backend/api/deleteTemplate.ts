import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { Response } from 'express';

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

    // Delete the template
    const { error: deleteError } = await supabaseDb
      .from('templates')
      .delete()
      .eq('id', templateId);

    if (deleteError) throw deleteError;

    res.status(200).json({ message: 'Template deleted successfully' });
    return;
  } catch (error) {
    console.error('Error deleting template:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete template',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
    return;
  }
};

export default handler;
