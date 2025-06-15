// Minimal Supabase client for Chrome extension
// https://lqcsassinqfruvpgcooo.supabase.co
// anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxY3Nhc3NpbnFmcnV2cGdjb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NTYzNTQsImV4cCI6MjA1OTAzMjM1NH0._s3bVTIJCDQCS2WCgOqE5WvMvMDtJ9tjgslR5om7DHw

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const supabase = createClient(
  'https://lqcsassinqfruvpgcooo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxY3Nhc3NpbnFmcnV2cGdjb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NTYzNTQsImV4cCI6MjA1OTAzMjM1NH0._s3bVTIJCDQCS2WCgOqE5WvMvMDtJ9tjgslR5om7DHw'
); 