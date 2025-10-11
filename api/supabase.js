// /api/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // optional (for ingest/cron)

function assertEnv(url, key) {
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL / SUPABASE_ANON_KEY).');
  }
}

/**
 * getSupabase('anon')   -> RLS-safe reads (default)
 * getSupabase('service')-> privileged writes/ingest (requires SERVICE_ROLE_KEY)
 */
export function getSupabase(role = 'anon') {
  if (role === 'service') {
    assertEnv(SUPABASE_URL, SERVICE_KEY);
    return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  }
  assertEnv(SUPABASE_URL, ANON_KEY);
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

// Small helpers for consistent responses
export function ok(data) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
export function fail(status, message) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
