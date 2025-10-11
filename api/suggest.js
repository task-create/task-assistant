// /api/suggest.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function withCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  withCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const body = await readJsonBody(req);
  const text = (body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });

  const { error } = await SUPABASE
    .from('suggestions')       // table name
    .insert({ text });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true });
}
