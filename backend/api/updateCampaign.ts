import { supabase } from '../lib/supabase';
import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, name, job_req } = req.body;

  if (!id || !name || !job_req) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const { error } = await supabase
      .from('campaigns')
      .update({ name, job_req })
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({ message: 'Campaign updated successfully' });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}

