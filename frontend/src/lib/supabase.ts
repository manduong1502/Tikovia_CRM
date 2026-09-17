import { createClient } from '@supabase/supabase-js';

// These are placeholders for the future Supabase integration.
// Replace with actual URL and ANON KEY from the Supabase dashboard.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
