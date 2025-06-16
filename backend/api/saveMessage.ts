import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export default async function saveMessage(req: Request, res: Response) {
  const { user_id, name, subject, message, tone, is_default } = req.body;

  if (!user_id || !name || !subject || !message) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // Create the message template
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .insert([
        {
          user_id,
          name,
          subject,
          message,
          tone,
          is_default
        }
      ])
      .select()
      .single();

    if (templateError) {
      console.error('[saveMessage] Error:', templateError);
      res.status(500).json({ error: templateError.message });
      return;
    }

    // If this is set as default, update other templates to not be default
    if (is_default) {
      const { error: updateError } = await supabase
        .from('message_templates')
        .update({ is_default: false })
        .eq('user_id', user_id)
        .neq('id', template.id);

      if (updateError) {
        console.error('[saveMessage] Error updating defaults:', updateError);
        // Don't return error here as the template was still saved
      }
    }

    res.status(200).json({ template });
  } catch (err: any) {
    console.error('[saveMessage] Server Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}

