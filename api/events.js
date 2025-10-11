// /api/events.js
export const config = { runtime: 'nodejs' };

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

async function pgSelect(path) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');

  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      Prefer: 'count=exact',
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`PostgREST ${r.status}: ${t}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    // Upcoming first if you later add a date filter; otherwise recent
    const rows = await pgSelect('events?select=*&order=is_active.desc,created_at.desc');

    const data = (rows || []).map((e) => ({
      name: e.name || '',
      description: e.description || '',
      event_date: e.event_date || null,
      schedule: e.schedule || '',
      signup_link: e.signup_link || '',
      requirements: e.requirements || '',
      is_active: e.is_active ?? true,
      created_at: e.created_at || null,
    }));

    res.status(200).json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'query failed' });
  }
}
