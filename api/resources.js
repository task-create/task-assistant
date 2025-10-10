import { createClient } from '@supabase/supabase-js';
export const config = { runtime: 'nodejs' };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    console.error('Error fetching resources:', error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
