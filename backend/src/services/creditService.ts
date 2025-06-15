import { supabase } from '../lib/supabase';

export const deductCredits = async (userId: string, amount: number, checkOnly: boolean = false) => {
  try {
    // Get current credits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    const currentCredits = userData?.credits || 0;

    if (checkOnly) {
      return currentCredits;
    }

    if (currentCredits < amount) {
      throw new Error('Insufficient credits');
    }

    // Deduct credits
    const { data, error } = await supabase
      .from('users')
      .update({ credits: currentCredits - amount })
      .eq('id', userId)
      .select('credits')
      .single();

    if (error) {
      throw error;
    }

    return data.credits;
  } catch (error) {
    console.error('Error deducting credits:', error);
    throw error;
  }
}; 