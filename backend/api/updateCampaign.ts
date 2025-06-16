import { supabase } from '../lib/supabase';
import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { id, name, job_req } = req.body;

  if (!id || !name || !job_req) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }

  try {
    const { error } = await supabase
      .from('campaigns')
      .update({ name, job_req })
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({ message: 'Campaign updated successfully' });
    return;
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}

