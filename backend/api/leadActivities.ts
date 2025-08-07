import { Router, Response } from 'express';
import { ApiRequest } from '../types/api';
import { requireAuth } from '../middleware/authMiddleware';
import { supabase } from '../lib/supabase';

const router = Router();

/**
 * GET /api/lead-activities?lead_id={id}
 * Get all activities for a specific lead, ordered by timestamp (newest first)
 */
router.get('/', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { lead_id } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication required' 
      });
    }

    if (!lead_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lead ID is required' 
      });
    }

    // Verify user owns the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', lead_id)
      .eq('user_id', userId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lead not found or access denied' 
      });
    }

    // Get activities for the lead
    const { data: activities, error } = await supabase
      .from('lead_activities')
      .select(`
        id,
        activity_type,
        tags,
        notes,
        activity_timestamp,
        created_at,
        updated_at
      `)
      .eq('lead_id', lead_id)
      .order('activity_timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching lead activities:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch activities' 
      });
    }

    res.json({
      success: true,
      activities: activities || []
    });

  } catch (error) {
    console.error('Error in GET /lead-activities:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

/**
 * POST /api/lead-activities
 * Create a new activity log entry for a lead
 */
router.post('/', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { 
      lead_id, 
      activity_type, 
      tags, 
      notes, 
      activity_timestamp 
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication required' 
      });
    }

    // Validate required fields
    if (!lead_id || !activity_type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lead ID and activity type are required' 
      });
    }

    // Validate activity_type
    const validTypes = ['Call', 'Meeting', 'Outreach', 'Email', 'LinkedIn', 'Note', 'Other'];
    if (!validTypes.includes(activity_type)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid activity type. Must be one of: ${validTypes.join(', ')}` 
      });
    }

    // Verify user owns the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, first_name, last_name')
      .eq('id', lead_id)
      .eq('user_id', userId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lead not found or access denied' 
      });
    }

    // Create the activity
    const activityData = {
      lead_id,
      user_id: userId,
      activity_type,
      tags: tags || [],
      notes: notes || null,
      activity_timestamp: activity_timestamp || new Date().toISOString()
    };

    const { data: activity, error } = await supabase
      .from('lead_activities')
      .insert(activityData)
      .select(`
        id,
        activity_type,
        tags,
        notes,
        activity_timestamp,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Error creating lead activity:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to create activity' 
      });
    }

    res.status(201).json({
      success: true,
      activity,
      message: `${activity_type} activity logged successfully`
    });

  } catch (error) {
    console.error('Error in POST /lead-activities:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

/**
 * PUT /api/lead-activities/:id
 * Update an existing activity log entry
 */
router.put('/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      activity_type, 
      tags, 
      notes, 
      activity_timestamp 
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication required' 
      });
    }

    // Verify user owns the activity
    const { data: existingActivity, error: checkError } = await supabase
      .from('lead_activities')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (checkError || !existingActivity) {
      return res.status(404).json({ 
        success: false, 
        message: 'Activity not found or access denied' 
      });
    }

    // Validate activity_type if provided
    if (activity_type) {
      const validTypes = ['Call', 'Meeting', 'Outreach', 'Email', 'LinkedIn', 'Note', 'Other'];
      if (!validTypes.includes(activity_type)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid activity type. Must be one of: ${validTypes.join(', ')}` 
        });
      }
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (activity_type !== undefined) updateData.activity_type = activity_type;
    if (tags !== undefined) updateData.tags = tags;
    if (notes !== undefined) updateData.notes = notes;
    if (activity_timestamp !== undefined) updateData.activity_timestamp = activity_timestamp;

    // Update the activity
    const { data: activity, error } = await supabase
      .from('lead_activities')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        activity_type,
        tags,
        notes,
        activity_timestamp,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Error updating lead activity:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to update activity' 
      });
    }

    res.json({
      success: true,
      activity,
      message: 'Activity updated successfully'
    });

  } catch (error) {
    console.error('Error in PUT /lead-activities/:id:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

/**
 * DELETE /api/lead-activities/:id
 * Delete an activity log entry
 */
router.delete('/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication required' 
      });
    }

    // Verify user owns the activity and delete it
    const { error } = await supabase
      .from('lead_activities')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting lead activity:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to delete activity' 
      });
    }

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /lead-activities/:id:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

export default router;