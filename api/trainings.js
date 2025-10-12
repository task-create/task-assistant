// /api/trainings.js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Use today's date to filter upcoming items
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const { data, error } = await supabase
      .from('trainings')
      .select('id,name,description,location,next_start_date,is_active,signup_link')
      .eq('is_active', true)
      .gte('next_start_date', today)
      .order('next_start_date', { ascending: true })
      .limit(200);

    if (error) throw error;

    // Build a friendly timestamp WITHOUT touching the DB schema
    const results = (data || []).map(row => {
      // If you want a default 09:00 local time for display, compute it here:
      let start_at_iso = null;
      if (row.next_start_date) {
        // Construct a local datetime string like 'YYYY-MM-DDT09:00:00'
        start_at_iso = `${row.next_start_date}T09:00:00`;
      }
      return { ...row, start_at: start_at_iso };
    });

    res.status(200).json({ trainings: results });
  } catch (e) {
    res.status(502).json({ error: e.message || String(e) });
  }
}
