import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { SUBSCRIPTION_PLANS } from '../config/pricing';

// Load environment variables from the backend root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addTeamCredits() {
  try {
    console.log('Looking up user...');
    // Get user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'brandon.omoregie@outlook.com')
      .single();

    if (userError) {
      console.error('User error:', userError);
      throw new Error('User not found');
    }

    if (!user) {
      throw new Error('User not found');
    }

    console.log('Found user:', user.id);

    const teamCredits = SUBSCRIPTION_PLANS.TEAM.credits;
    
    // Check if user already has a credit record
    const { data: existingCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (creditsError && creditsError.code !== 'PGRST116') {
      console.error('Error checking existing credits:', creditsError);
      throw creditsError;
    }

    if (existingCredits) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          balance: existingCredits.balance + teamCredits,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating credits:', updateError);
        throw updateError;
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from('user_credits')
        .insert({
          user_id: user.id,
          balance: teamCredits
        });

      if (insertError) {
        console.error('Error creating credit record:', insertError);
        throw insertError;
      }
    }

    // Verify final credit status
    const { data: finalStatus, error: statusError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (statusError) {
      console.error('Error fetching final status:', statusError);
    } else {
      console.log('Current credit status:', finalStatus);
    }

    console.log('Successfully added Team package credits');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

addTeamCredits(); 