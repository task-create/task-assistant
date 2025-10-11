// /api/trainings.js
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
    // Sort by next_start_date (or created_at if null), active first
    const rows = await pgSelect(
      'trainings?select=*&order=is_active.desc,created_at.desc'
    );

    // Map your column typos to a clean, stable schema
    const data = (rows || []).map((t) => ({
      name: t.name || '',
      description: t.description || '',
      schedule: t.schedule || '',
      next_start_date: t.next_start_dat ?? t.next_start_date ?? null,
      app_window_start: t.app_window_s ?? t.app_window_start ?? null,
      app_window_end: t.app_window_e ?? t.app_window_end ?? null,
      requirements: t.requiremetns ?? t.requirements ?? '',
      contact_info: t.contact_info || '',
      signup_link: t.signup_link || '',
      duration: t.duration || '',
      start_date_note: t.start_date_not ?? t.start_date_note ?? '',
      is_active: t.is_active ?? true,
      created_at: t.created_at || null,
    }));

    res.status(200).json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'query failed' });
  }
}
