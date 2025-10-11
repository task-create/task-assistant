// /api/trainings.js
export const config = { runtime: 'nodejs' };
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try {
    const { data, error } = await supabase
      .from('trainings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map with fallbacks to your current column names
    const mapped = (data || []).map(r => ({
      id: r.id,
      name: r.name ?? '',
      description: r.description ?? '',
      schedule: r.schedule ?? '',
      next_start_date: r.next_start_date ?? r.next_start_dat ?? null,
      app_window_start: r.app_window_start ?? r.app_window_s ?? null,
      app_window_end: r.app_window_end ?? r.app_window_e ?? null,
      requirements: r.requirements ?? r.requiremetns ?? '',
      signup_link: r.signup_link ?? '',
      duration: r.duration ?? '',
      start_date_note: r.start_date_note ?? r.start_date_not ?? ''
    }));

    return res.status(200).json({ ok: true, data: mapped });
  } catch (e) {
    console.error('TRAININGS_API_ERROR', e);
    return res.status(500).json({ ok:false, error: e.message || 'server' });
  }
}
