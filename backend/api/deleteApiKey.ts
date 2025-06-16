import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { Response } from 'express';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { keyId } = req.params;
    if (!keyId) {
      res.status(400).json({ error: 'Missing API key ID' });
      return;
    }

    // Verify ownership
    const { data: key, error: fetchError } = await supabaseDb
      .from('api_keys')
      .select('*')
      .eq('id', keyId)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError) throw fetchError;
    if (!key) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    const { error: deleteError } = await supabaseDb
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', req.user.id);

    if (deleteError) throw deleteError;

    res.status(200).json({ message: 'API key deleted successfully' });
    return;
  } catch (error) {
    console.error('Error deleting API key:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete API key',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
    return;
  }
};

export default handler; 