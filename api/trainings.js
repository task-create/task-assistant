// /api/trainings.js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const nowIso = new Date().toISOString();

    // Prefer trainings with start_at >= now; if some rows lack start_at,
    // you can fall back to next_start_date in a second query if needed.
    const { data, error } = await supabase
      .from('trainings')
      .select('id,name,description,location,start_at,next_start_date,is_active,signup_link')
      .eq('is_active', true)
      .gte('start_at', nowIso)
      .order('start_at', { ascending: true, nullsFirst: false })
      .limit(200);

    if (error) throw error;

    // Optional: also include items missing start_at but with a future next_start_date
    // (Uncomment if you still have legacy rows without start_at)
    /*
    let results = data ?? [];
    if ((results?.length ?? 0) < 10) {
      const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
      const { data: fallback, error: fbErr } = await supabase
        .from('trainings')
        .select('id,name,description,location,start_at,next_start_date,is_active,signup_link')
        .eq('is_active', true)
        .is('start_at', null)
        .gte('next_start_date', today)
        .order('next_start_date', { ascending: true })
        .limit(200);
      if (fbErr) throw fbErr;
      results = [...results, ...(fallback ?? [])];
    }
    */

    res.status(200).json({ trainings: data ?? [] });
  } catch (e) {
    res.status(502).json({ error: e.message || String(e) });
  }
}
