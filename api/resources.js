// /api/resources.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function withCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  withCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { data, error } = await SUPABASE
    .from('resources')         // table name
    .select('*')
    .order('priority', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ data });
}
