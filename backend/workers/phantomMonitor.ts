import { createClient } from '@supabase/supabase-js';
import pb from '../lib/phantombuster';
import { sendNotify } from '../lib/notifications';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function monitorPhantomRuns() {
  try {
    // grab oldest running PB run
    const { data: runs, error: runsError } = await supabase
      .from('campaign_runs')
      .select(`
        id,
        pb_run_id,
        phantom_id,
        campaign_id,
        started_at,
        campaigns (
          title,
          user_id
        )
      `)
      .eq('status', 'running');

    if (runsError) {
      console.error('Error fetching runs:', runsError);
      return;
    }

    for (const run of runs) {
      try {
        const status = await pb.getRun(run.pb_run_id);
        
        // Skip if not successful
        if (status.state !== 'success') {
          // Check for timeout (15 minutes)
          const startedAt = new Date(run.started_at);
          const now = new Date();
          const minutesElapsed = (now.getTime() - startedAt.getTime()) / (1000 * 60);
          
          if (minutesElapsed > 15) {
            // Mark as failed
            await supabase
              .from('campaign_runs')
              .update({ 
                status: 'failed',
                finished_at: new Date().toISOString()
              })
              .eq('id', run.id);

            // Release phantom
            await supabase
              .from('phantoms')
              .update({ status: 'idle' })
              .eq('id', run.phantom_id);

            // Send notification
            await sendNotify('failed', {
              campaign: run.campaigns,
              run_id: run.id
            });
          }
          continue;
        }

        // Download leads
        const rows = await pb.getOutput(run.pb_run_id);

        // Store raw leads
        const { error: rawError } = await supabase
          .from('leads_raw')
          .insert(rows.map(l => ({
            campaign_run_id: run.id,
            linkedin_url: l.linkedInProfile,
            first_name: l.firstName,
            last_name: l.lastName,
            title: l.jobTitle,
            company_name: l.companyName,
            location: l.location,
            raw_payload: l
          })));

        if (rawError) {
          console.error('Error inserting raw leads:', rawError);
          continue;
        }

        // Mark run as completed
        await supabase
          .from('campaign_runs')
          .update({ 
            status: 'completed',
            finished_at: new Date().toISOString()
          })
          .eq('id', run.id);

        // Release phantom
        await supabase
          .from('phantoms')
          .update({ status: 'idle' })
          .eq('id', run.phantom_id);

        // Send notification
        await sendNotify('complete', {
          campaign: run.campaigns,
          run_id: run.id,
          lead_count: rows.length
        });
      } catch (error) {
        console.error(`Error processing run ${run.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Monitor error:', error);
  }
} 