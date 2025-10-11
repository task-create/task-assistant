// /api/trainings.js
import { createClient } from '@supabase/supabase-js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return json(res, 200, { ok: false, error: 'Supabase env missing', data: [] });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  try {
    const { data, error } = await supabase
      .from('trainings')                // <-- your table name
      .select('*')                      // pick columns you need
      .order('next_start_date', { ascending: true, nullsFirst: false })
      .limit(50);

    if (error) return json(res, 200, { ok: false, error: error.message, data: [] });
    return json(res, 200, { ok: true, data });
  } catch (e) {
    return json(res, 200, { ok: false, error: e?.message || 'unknown', data: [] });
  }
}
