// /api/resources.js
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
    const rows = await pgSelect('resources?select=*&order=created_at.desc');

    const data = (rows || []).map((r) => ({
      name: r.name || '',
      category: r.category || '',
      description: r.description || '',
      website: r.website || '',
      phone_number: r.phone_number || '',
      created_at: r.created_at || null,
    }));

    res.status(200).json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'query failed' });
  }
}
