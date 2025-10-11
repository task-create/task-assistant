// /supabase.js  — runs in the browser (ESM)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://yamqxbmckcaaltswxmny.supabase.co';
// anon key is client-safe (RLS protects data)
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhbXF4Ym1ja2NhYWx0c3d4bW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTcxODEsImV4cCI6MjA3NTY5MzE4MX0.KqBwtiCFsu6mwFqiSIV5wmuh7C00-uPK4CADY29r0ws';

let _sb;
export async function getSupabase() {
  if (_sb) return _sb;
  _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  return _sb;
}
