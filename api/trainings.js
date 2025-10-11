// /api/trainings.js
export const config = { runtime: 'nodejs' };
import { sb, withCors } from './_supabase';

export default async function handler(req, res) {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { data, error } = await sb()
      .from('trainings')
      .select('name, description, schedule, next_start_date, start_date_note, app_window_start, app_window_end, requirements')
      .order('next_start_date', { ascending: true });
    if (error) throw error;
    return res.status(200).json({ ok:true, data });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}
