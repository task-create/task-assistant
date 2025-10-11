import { getSupabase } from './_supabase';
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('trainings')
      .select('*')
      .eq('is_active', true)
      .order('next_start_date', { ascending: true })
      .limit(50);

    if (error) throw error;
    res.status(200).json({ ok:true, data: data ?? [] });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message || 'server_error' });
  }
}
