import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_LINKEDIN_WEBHOOK_URL2 || "https://hooks.zapier.com/hooks/catch/18279230/u2qdg1l/";
const DAILY_LIMIT = 20;

// Cookie decryption (matches linkedinSaveCookie.ts)
const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY?.slice(0, 32) || 'default_key_32_bytes_long_123456';

function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export async function processLinkedInOutreachQueue() {
  try {
    console.log('[processLinkedInOutreachQueue] Processing LinkedIn outreach queue...');
    
    // Step 1: Get pending items that are ready to be sent
    const { data: queuedItems, error: fetchError } = await supabase
      .from("linkedin_outreach_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(20); // max queue batch

    if (fetchError) {
      console.error('[processLinkedInOutreachQueue] Error fetching queued items:', fetchError);
      return;
    }

    if (!queuedItems || queuedItems.length === 0) {
      console.log('[processLinkedInOutreachQueue] No pending items to process');
      return;
    }

    console.log(`[processLinkedInOutreachQueue] Found ${queuedItems.length} items to process`);

    for (const item of queuedItems) {
      try {
        // Step 2: Check user's send count today
        // Check user's send count today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count, error: countError } = await supabase
          .from("linkedin_outreach_queue")
          .select("*", { count: "exact", head: true })
          .eq("user_id", item.user_id)
          .eq("status", "sent")
          .gte("sent_at", today.toISOString());

        if (countError) {
          console.error(`[processLinkedInOutreachQueue] Error checking daily count for user ${item.user_id}:`, countError);
          continue;
        }

        if (count >= DAILY_LIMIT) {
          console.log(`[processLinkedInOutreachQueue] User ${item.user_id} has reached daily limit (${count}/${DAILY_LIMIT})`);
          continue; // skip user
        }

        // Step 3: Get user's LinkedIn cookie
        console.log(`[processLinkedInOutreachQueue] Fetching LinkedIn cookie for user ${item.user_id}`);
        
        const { data: cookieData, error: cookieError } = await supabase
          .from('linkedin_cookies')
          .select('session_cookie')
          .eq('user_id', item.user_id)
          .single();

        if (cookieError || !cookieData?.session_cookie) {
          console.error(`[processLinkedInOutreachQueue] No LinkedIn cookie found for user ${item.user_id}:`, cookieError);
          
          // Update status to failed
          await supabase
            .from("linkedin_outreach_queue")
            .update({ 
              status: "failed", 
              retry_count: item.retry_count + 1 
            })
            .eq("id", item.id);
          
          continue;
        }

        // Decrypt the session cookie
        let sessionCookie: string;
        try {
          sessionCookie = decrypt(cookieData.session_cookie);
        } catch (decryptError) {
          console.error(`[processLinkedInOutreachQueue] Failed to decrypt cookie for user ${item.user_id}:`, decryptError);
          
          // Update status to failed
          await supabase
            .from("linkedin_outreach_queue")
            .update({ 
              status: "failed", 
              retry_count: item.retry_count + 1 
            })
            .eq("id", item.id);
          
          continue;
        }

        // Step 4: Fire Zapier webhook
        console.log(`[processLinkedInOutreachQueue] Sending LinkedIn request for item ${item.id}`);
        
        await axios.post(ZAPIER_WEBHOOK_URL, {
          linkedin_url: item.linkedin_url,
          message: item.message,
          phantom_api_key: process.env.PHANTOMBUSTER_API_KEY,
          session_cookie: sessionCookie,
          phantom_agent_id: item.phantom_agent_id,
          queue_item_id: item.id
        });

        // Step 5: Update status to sent
        const { error: updateError } = await supabase
          .from("linkedin_outreach_queue")
          .update({ 
            status: "sent", 
            sent_at: new Date().toISOString() 
          })
          .eq("id", item.id);

        if (updateError) {
          console.error(`[processLinkedInOutreachQueue] Error updating item ${item.id} to sent:`, updateError);
        } else {
          console.log(`[processLinkedInOutreachQueue] Successfully sent LinkedIn request for item ${item.id}`);
        }

      } catch (err) {
        console.error(`[processLinkedInOutreachQueue] Error processing item ${item.id}:`, err);
        
        // Update status to failed and increment retry count
        const { error: failError } = await supabase
          .from("linkedin_outreach_queue")
          .update({ 
            status: "failed", 
            retry_count: item.retry_count + 1 
          })
          .eq("id", item.id);

        if (failError) {
          console.error(`[processLinkedInOutreachQueue] Error updating failed status for item ${item.id}:`, failError);
        }
      }
    }

    console.log('[processLinkedInOutreachQueue] Queue processing completed');
    
  } catch (error) {
    console.error('[processLinkedInOutreachQueue] Fatal error:', error);
  }
}

// Run the queue processor if this file is executed directly
if (require.main === module) {
  processLinkedInOutreachQueue()
    .then(() => {
      console.log('[processLinkedInOutreachQueue] Process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[processLinkedInOutreachQueue] Process failed:', error);
      process.exit(1);
    });
} 