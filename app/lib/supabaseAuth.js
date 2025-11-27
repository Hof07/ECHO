// app/lib/supabaseAuth.js
// This client is typically used for client-side authentication calls (like OAuth)
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Note: You might want to use the same 'supabase' export as above, 
// but keeping them separate for clarity if you were planning to use a different setup.
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);