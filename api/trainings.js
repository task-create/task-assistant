// /api/trainings.js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('trainings')
      .select('id,title,description,start_at,location')
      .gte('start_at', nowIso)
      .order('start_at', { ascending: true })
      .limit(200);

    if (error) throw error;
    res.status(200).json({ trainings: data ?? [] });
  } catch (e) {
    res.status(502).json({ error: e.message || String(e) });
  }
}
