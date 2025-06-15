import { supabase } from '../lib/supabase';

export const getTemplates = async (userId) => {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const saveTemplate = async (userId, name, content) => {
  const { data, error } = await supabase
    .from('templates')
    .insert([{ user_id: userId, name, content }]);
  if (error) throw error;
  return data;
};

export const updateTemplate = async (userId, templateId, name, content) => {
  const { data, error } = await supabase
    .from('templates')
    .update({ name, content, updated_at: new Date() })
    .eq('id', templateId)
    .eq('user_id', userId);
  if (error) throw error;
  return data;
};

export const deleteTemplate = async (userId, templateId) => {
  const { data, error } = await supabase
    .from('templates')
    .delete()
    .eq('id', templateId)
    .eq('user_id', userId);
  if (error) throw error;
  return data;
};
