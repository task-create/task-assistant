// /api/jobs.js
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (res.req.method === 'OPTIONS') return res.end();
  res.end(JSON.stringify(body));
}

async function getClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  try {
    const supabase = await getClient();
    if (!supabase) return json(res, 200, { ok: false, error: 'Supabase env missing', data: [] });

    // Adjust table/columns if yours differ
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(50);

    if (error) return json(res, 200, { ok: false, error: error.message, data: [] });
    return json(res, 200, { ok: true, data });
  } catch (e) {
    return json(res, 200, { ok: false, error: e?.message || 'unknown', data: [] });
  }
}
