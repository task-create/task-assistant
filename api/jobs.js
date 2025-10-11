// /api/jobs.js
export const config = { runtime: 'nodejs' };
import { sb, withCors } from './_supabase';

export default async function handler(req, res) {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { data, error } = await sb()
      .from('jobs')
      .select('title, company, apply_link')
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) throw error;
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}
