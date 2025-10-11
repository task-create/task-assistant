// /api/resources.js
export const config = { runtime: 'nodejs' };
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnon = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      return res.status(500).json({ ok: false, error: 'Missing Supabase env (SUPABASE_URL / SUPABASE_ANON_KEY)' });
    }
    const supabase = createClient(supabaseUrl, supabaseAnon);

    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit || '200', 10)));

    // Your schema screenshot for `resources` doesn’t show an `is_active` flag,
    // so we just list all and sort by name/category.
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('category', { ascending: true, nullsFirst: true })
      .order('name', { ascending: true })
      .limit(limit);

    if (error) throw error;

    res.status(200).json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
