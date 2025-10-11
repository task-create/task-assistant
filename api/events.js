// /api/events.js
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
      .from('events')
      .select('*')
      .eq('is_active', true)
      .order('event_date', { ascending: true });

    if (error) throw error;
    return res.status(200).json({ ok:true, data: data || [] });
  } catch (e) {
    console.error('EVENTS_API_ERROR', e);
    return res.status(500).json({ ok:false, error: e.message || 'server' });
  }
}
