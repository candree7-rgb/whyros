import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase credentials not configured. Running in test mode.');
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseServiceKey || 'test-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
