import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const LEVER_API_URL = 'https://api.lever.co/v1';

export default async function searchLeverLeads(req: Request, res: Response) {
  const { user_id, job_title, location, keywords } = req.body;

  if (!user_id) {
    res.status(400).json({ error: 'Missing user_id' });
    return;
  }

  try {
    // Get user settings to check Lever API key
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (settingsError) throw settingsError;

    if (!settings?.lever_api_key) {
      res.status(400).json({ error: 'No Lever API key found' });
      return;
    }

    // Prepare Lever API request
    const searchParams = {
      limit: 25,
      offset: 0,
      expand: ['applications', 'resumes', 'notes'],
      ...(job_title && { 'requisition.title': job_title }),
      ...(location && { 'requisition.location': location }),
      ...(keywords && { 'requisition.description': keywords })
    };

    // Call Lever API
    const response = await axios.get(`${LEVER_API_URL}/candidates`, {
      params: searchParams,
      headers: {
        'Authorization': `Basic ${Buffer.from(settings.lever_api_key + ':').toString('base64')}`,
        'Accept': 'application/json'
      }
    });

    if (!response.data || !response.data.data) {
      res.status(404).json({ error: 'No leads found' });
      return;
    }

    // Transform Lever response to our lead format
    const leads = response.data.data.map((candidate: any) => ({
      first_name: candidate.name?.split(' ')[0] || '',
      last_name: candidate.name?.split(' ').slice(1).join(' ') || '',
      title: candidate.applications?.[0]?.requisition?.title || '',
      company: candidate.applications?.[0]?.requisition?.department || '',
      email: candidate.emails?.[0] || '',
      linkedin_url: candidate.links?.find((link: any) => link.type === 'linkedin')?.url || '',
      phone: candidate.phones?.[0] || '',
      enrichment_data: {
        lever_id: candidate.id,
        requisition_id: candidate.applications?.[0]?.requisition?.id,
        requisition_title: candidate.applications?.[0]?.requisition?.title,
        requisition_department: candidate.applications?.[0]?.requisition?.department,
        requisition_location: candidate.applications?.[0]?.requisition?.location,
        requisition_description: candidate.applications?.[0]?.requisition?.description,
        application_id: candidate.applications?.[0]?.id,
        application_status: candidate.applications?.[0]?.status,
        application_created_at: candidate.applications?.[0]?.createdAt,
        application_updated_at: candidate.applications?.[0]?.updatedAt,
        resume_url: candidate.resumes?.[0]?.url,
        notes: candidate.notes?.map((note: any) => ({
          id: note.id,
          text: note.text,
          created_at: note.createdAt,
          updated_at: note.updatedAt
        }))
      }
    }));

    res.status(200).json({ leads });
    return;
  } catch (err: any) {
    console.error('[searchLeverLeads] Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
    return;
  }
} 