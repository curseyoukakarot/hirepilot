import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function testLeadStatusUpdate(req: Request, res: Response) {
  try {
    const userId = req.query.user_id as string;
    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }

    console.log('[testLeadStatusUpdate] Testing lead status update trigger for user:', userId);

    // Step 1: Find a lead with "New" status
    const { data: newLeads, error: leadsError } = await supabaseDb
      .from('leads')
      .select('id, email, first_name, last_name, status, contacted_at')
      .eq('user_id', userId)
      .eq('status', 'New')
      .limit(1);

    if (leadsError) {
      console.error('[testLeadStatusUpdate] Error finding leads:', leadsError);
      return res.status(500).json({ error: 'Failed to find leads' });
    }

    if (!newLeads || newLeads.length === 0) {
      return res.status(404).json({ 
        error: 'No leads with "New" status found',
        suggestion: 'Create a lead with "New" status first'
      });
    }

    const lead = newLeads[0];
    console.log('[testLeadStatusUpdate] Found lead with New status:', lead);

    // Step 2: Insert a test message to trigger the status update
    const { data: message, error: messageError } = await supabaseDb
      .from('messages')
      .insert({
        user_id: userId,
        lead_id: lead.id,
        to_email: lead.email,
        subject: 'Test message for status update',
        content: 'This is a test message to verify the lead status update trigger works correctly.',
        provider: 'test',
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (messageError) {
      console.error('[testLeadStatusUpdate] Error inserting message:', messageError);
      return res.status(500).json({ error: 'Failed to insert test message' });
    }

    console.log('[testLeadStatusUpdate] Inserted test message:', message);

    // Step 3: Wait a moment for the trigger to execute
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 4: Check if the lead status was updated
    const { data: updatedLead, error: updateError } = await supabaseDb
      .from('leads')
      .select('id, email, first_name, last_name, status, contacted_at, updated_at')
      .eq('id', lead.id)
      .single();

    if (updateError) {
      console.error('[testLeadStatusUpdate] Error checking updated lead:', updateError);
      return res.status(500).json({ error: 'Failed to check updated lead' });
    }

    console.log('[testLeadStatusUpdate] Lead after message:', updatedLead);

    // Step 5: Check if email_events was created
    const { data: emailEvents, error: eventsError } = await supabaseDb
      .from('email_events')
      .select('*')
      .eq('message_id', message.id.toString())
      .eq('event_type', 'sent');

    if (eventsError) {
      console.error('[testLeadStatusUpdate] Error checking email events:', eventsError);
    }

    // Step 6: Cleanup - delete the test message
    await supabaseDb
      .from('messages')
      .delete()
      .eq('id', message.id);

    // Results
    const triggerWorked = updatedLead.status === 'Contacted';
    const contactedAtSet = updatedLead.contacted_at !== null;
    const emailEventCreated = emailEvents && emailEvents.length > 0;

    return res.json({
      success: true,
      test_results: {
        trigger_worked: triggerWorked,
        contacted_at_set: contactedAtSet,
        email_event_created: emailEventCreated,
        original_lead: lead,
        updated_lead: updatedLead,
        message_sent: message,
        email_events: emailEvents || []
      },
      summary: triggerWorked 
        ? '✅ Trigger is working correctly - status changed from "New" to "Contacted"'
        : '❌ Trigger is NOT working - status did not change to "Contacted"'
    });

  } catch (error) {
    console.error('[testLeadStatusUpdate] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 