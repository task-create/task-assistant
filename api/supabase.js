// api/_supabase.js
export const config = { runtime: 'nodejs' };

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY; // prefer service key

if (!url || !serviceKey) {
  console.error('Supabase env missing:', { hasUrl: !!url, hasKey: !!serviceKey });
}

export function getSupabase() {
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'solace-api/1.0' } },
  });
}

export function ok(res, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return res.status(200).json({ ok: true, data });
}

export function err(res, status, error) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  console.error('API error', status, error);
  return res.status(status).json({ ok: false, error: String(error?.message || error) });
}
