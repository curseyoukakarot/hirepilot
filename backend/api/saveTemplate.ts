import { supabase } from '../lib/supabase';
import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, name, content } = req.body;

  try {
    const { data, error } = await supabase.from('templates').insert({
      user_id,
      name,
      content,
    }).single();

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}
