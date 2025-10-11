import { getClient, setCors } from './_db';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getClient();
    // adjust table/columns to your schema
    const { data, error } = await supabase
      .from('trainings')
      .select('id,name,description,schedule,next_start_date,app_window_start,app_window_end,requirements,start_date_note')
      .order('next_start_date', { ascending: true });

    if (error) throw error;
    res.status(200).json({ ok: true, data: data || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
