// File: /api/trainings.js
// Vercel Node Serverless Function (NOT Edge)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY; // or SERVICE_KEY if you need RLS bypass (not recommended here)

// Small helper since we only need today's date in YYYY-MM-DD
function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // If env is missing, don't hang—just return empty
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json({ trainings: [] });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
    global: { headers: { 'x-client-info': 'solace-trainings-route' } }
  });

  try {
    const today = todayISODate();

    // Query only what we need; filter & limit to avoid long scans
    const { data, error } = await supabase
      .from('trainings')
      .select('id,name,description,location,next_start_date,is_active,signup_link', { head: false })
      .eq('is_active', true)
      .gte('next_start_date', today)
      .order('next_start_date', { ascending: true })
      .limit(200);

    if (error) throw error;

    // Return as-is; frontend can format dates/times
    return res.status(200).json({ trainings: data ?? [] });
  } catch (e) {
    // Never hang—surface the error and exit fast
    return res.status(502).json({ error: e?.message || String(e) });
  }
}
