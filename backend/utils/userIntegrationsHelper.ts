import { supabaseDb } from '../lib/supabase';

export interface UserIntegrations {
  hunter_api_key?: string;
  skrapp_api_key?: string;
}

/**
 * Fetch user integrations (Hunter.io and Skrapp.io API keys) for enrichment pipeline
 * Includes role-based access control to prevent unauthorized access to paid services
 * @param userId - The user ID to fetch integrations for
 * @returns User integrations object or empty object if no record exists or user lacks permissions
 */
export async function getUserIntegrations(userId: string): Promise<UserIntegrations> {
  try {
    // First, check if user has the required role for Hunter/Skrapp access
    const { data: userData, error: userError } = await supabaseDb
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user role for integrations:', userError);
      return {};
    }

    const role = userData?.role;
    // Role-based access control for Hunter/Skrapp enrichment features
    // Only allow: Super Admin, Pro, Team Admin, RecruitPro
    const allowedRoles = ['super_admin', 'Pro', 'team_admin', 'RecruitPro'];
    
    if (!role || !allowedRoles.includes(role)) {
      console.log(`User ${userId} with role '${role}' does not have access to premium enrichment features`);
      return {}; // Return empty integrations - user will fall back to Apollo only
    }

    // User has valid role, proceed to fetch integrations
    const { data, error } = await supabaseDb
      .from('user_integrations')
      .select('hunter_api_key, skrapp_api_key')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 = no rows found, which is expected if user hasn't set up integrations
      if (error.code === 'PGRST116') {
        console.log(`No integrations found for user ${userId}`);
        return {};
      }
      console.error('Error fetching user integrations:', error);
      return {};
    }

    // Filter out null values and return clean object
    const integrations: UserIntegrations = {};
    if (data.hunter_api_key) {
      integrations.hunter_api_key = data.hunter_api_key;
    }
    if (data.skrapp_api_key) {
      integrations.skrapp_api_key = data.skrapp_api_key;
    }

    console.log(`Retrieved integrations for user ${userId} (role: ${role}):`, {
      hasHunterKey: !!integrations.hunter_api_key,
      hasSkrappKey: !!integrations.skrapp_api_key
    });

    return integrations;
  } catch (err) {
    console.error('Unexpected error fetching user integrations:', err);
    return {};
  }
}

/**
 * Save or update user integrations (Hunter.io and Skrapp.io API keys)
 * @param userId - The user ID to save integrations for
 * @param integrations - The integration keys to save
 * @returns Success boolean
 */
export async function saveUserIntegrations(userId: string, integrations: UserIntegrations): Promise<boolean> {
  try {
    const { error } = await supabaseDb
      .from('user_integrations')
      .upsert({
        user_id: userId,
        hunter_api_key: integrations.hunter_api_key || null,
        skrapp_api_key: integrations.skrapp_api_key || null,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving user integrations:', error);
      return false;
    }

    console.log(`Successfully saved integrations for user ${userId}`);
    return true;
  } catch (err) {
    console.error('Unexpected error saving user integrations:', err);
    return false;
  }
} 