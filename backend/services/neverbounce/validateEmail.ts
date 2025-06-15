import axios from 'axios';
import { supabaseDb } from '../../lib/supabase';

const NEVERBOUNCE_API_URL = 'https://api.neverbounce.com/v4.2';

interface ValidationParams {
  leadId: string;
  email: string;
}

interface ValidationResponse {
  status: 'valid' | 'invalid' | 'disposable' | 'catchall' | 'unknown';
  result: string;
  flags: string[];
  suggested_correction?: string;
}

export async function validateEmail({ leadId, email }: ValidationParams): Promise<ValidationResponse> {
  try {
    // Get NeverBounce API key from environment
    const apiKey = process.env.NEVERBOUNCE_API_KEY;
    if (!apiKey) {
      throw new Error('NeverBounce API key not found');
    }

    // Validate email with NeverBounce
    const response = await axios.post(
      `${NEVERBOUNCE_API_URL}/single/check`,
      {
        email,
        key: apiKey
      }
    );

    if (!response.data) {
      throw new Error('No validation data received from NeverBounce');
    }

    const validation = response.data;

    // Update lead with validation result
    const { error: updateError } = await supabaseDb
      .from('leads')
      .update({
        email_validation: {
          status: validation.status,
          result: validation.result,
          flags: validation.flags,
          suggested_correction: validation.suggested_correction,
          validated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId);

    if (updateError) {
      throw new Error('Failed to update lead with email validation data');
    }

    return {
      status: validation.status,
      result: validation.result,
      flags: validation.flags,
      suggested_correction: validation.suggested_correction
    };
  } catch (error: any) {
    console.error('[validateEmail] Error:', error);
    throw new Error(error.message || 'Failed to validate email');
  }
} 