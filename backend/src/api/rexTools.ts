import { Request, Response } from 'express';
import { linkedin_connect } from '../../tools/rexToolFunctions';

export default async function rexToolsHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tool, args } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!tool) {
      return res.status(400).json({ error: 'Tool name is required' });
    }

    // Handle the linkedin_connect tool
    if (tool === 'linkedin_connect') {
      const { linkedin_urls, message, scheduled_at } = args || {};
      
      if (!linkedin_urls || !Array.isArray(linkedin_urls) || linkedin_urls.length === 0) {
        return res.status(400).json({ error: 'linkedin_urls array is required' });
      }

      const result = await linkedin_connect({
        userId,
        linkedin_urls,
        message,
        scheduled_at
      });

      return res.status(200).json(result);
    }

    // Add other tools here as needed
    return res.status(404).json({ error: `Tool '${tool}' not found` });

  } catch (error) {
    console.error('REX tools API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Specific handler for the linkedin_connect endpoint
export async function linkedinConnectHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { linkedin_urls, message, scheduled_at } = req.body;
    
    if (!linkedin_urls || !Array.isArray(linkedin_urls) || linkedin_urls.length === 0) {
      return res.status(400).json({ error: 'linkedin_urls array is required' });
    }

    const result = await linkedin_connect({
      userId,
      linkedin_urls,
      message,
      scheduled_at
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error('LinkedIn connect API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 