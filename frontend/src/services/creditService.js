import React from 'react';
import { supabase } from '../lib/supabase';

/**
 * Fetch user credit information from the backend
 * @returns {Promise<{totalCredits: number, usedCredits: number, remainingCredits: number}>}
 */
export async function getUserCredits() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get credit information from user_credits table
    const { data: creditData, error: creditError } = await supabase
      .from('user_credits')
      .select('total_credits, used_credits, remaining_credits')
      .eq('user_id', user.id)
      .single();

    if (creditError) {
      console.error('Error fetching credits:', creditError);
      
      // Fallback: Get role-based defaults
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user role:', userError);
        // Return default credits for members
        return {
          totalCredits: 350,
          usedCredits: 0,
          remainingCredits: 350
        };
      }

      const role = userData?.role || user?.user_metadata?.role || user?.user_metadata?.account_type || 'member';
      const defaultCredits = getRoleBasedCredits(role);
      
      return {
        totalCredits: defaultCredits,
        usedCredits: 0,
        remainingCredits: defaultCredits
      };
    }

    return {
      totalCredits: creditData.total_credits || 0,
      usedCredits: creditData.used_credits || 0,
      remainingCredits: creditData.remaining_credits || 0
    };
  } catch (error) {
    console.error('Error fetching user credits:', error);
    // Return safe defaults
    return {
      totalCredits: 350,
      usedCredits: 0,
      remainingCredits: 350
    };
  }
}

/**
 * Get default credits based on user role
 * @param {string} role - User role
 * @returns {number} Default credit amount
 */
function getRoleBasedCredits(role) {
  const creditsByRole = {
    'member': 350,
    'admin': 1000,
    'team_admin': 5000,
    'RecruitPro': 1000,
    'super_admin': 10000
  };
  
  return creditsByRole[role] || 350;
}

/**
 * Check if user has sufficient credits for an operation
 * @param {number} requiredCredits - Credits needed for operation
 * @returns {Promise<boolean>}
 */
export async function hasSufficientCredits(requiredCredits) {
  try {
    const credits = await getUserCredits();
    return credits.remainingCredits >= requiredCredits;
  } catch (error) {
    console.error('Error checking credit sufficiency:', error);
    return false;
  }
}

/**
 * React hook to get user credits with loading state
 * @returns {{credits: object, loading: boolean, error: string|null, refetch: function}}
 */
export function useUserCredits() {
  const [credits, setCredits] = React.useState({
    totalCredits: 0,
    usedCredits: 0,
    remainingCredits: 0
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const fetchCredits = async () => {
    try {
      setLoading(true);
      setError(null);
      const creditData = await getUserCredits();
      setCredits(creditData);
    } catch (err) {
      setError(err.message);
      console.error('Error in useUserCredits:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCredits();
  }, []);

  return {
    credits,
    loading,
    error,
    refetch: fetchCredits
  };
} 