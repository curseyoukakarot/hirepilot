import { ApiRequest, ApiResponse, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';

const handler: ApiHandler = async (req: ApiRequest, res: ApiResponse) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { templateId } = req.params;
    if (!templateId) {
      return res.status(400).json({ error: 'Missing template ID' });
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

    // Delete the template
    const { error: deleteError } = await supabaseDb
      .from('templates')
      .delete()
      .eq('id', templateId);

    if (deleteError) throw deleteError;

    return res.status(200).json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete template',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    return res.status(500).json(errorResponse);
  }
};

export default handler;
