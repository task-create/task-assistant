// /api/ai.js  — Vercel Serverless Function (Node, not Edge)

import { createClient } from '@supabase/supabase-js';

const SUPABASE = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';

function withCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
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

  try {
    const body = await readJsonBody(req);
    const userPrompt = (body?.prompt || '').trim();
    if (!userPrompt) return res.status(400).json({ error: 'Missing prompt' });

    // 1) Try Supabase knowledge base first
    const { data: kb, error: kbErr } = await SUPABASE
      .from('knowledge_base')              // table: change if needed
      .select('answer, priority')
      .ilike('question', `%${userPrompt}%`)
      .order('priority', { ascending: false })
      .limit(1);

    if (kbErr) console.error('KB error:', kbErr);
    if (kb?.[0]?.answer) {
      return res.status(200).json({ reply: kb[0].answer, source: 'kb' });
    }

    // 2) Fall back to Gemini
    if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'
      + `${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }]}],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(502).json({ error: 'Gemini error', detail: t });
    }

    const json = await resp.json();
    const reply =
      json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ||
      'Sorry, I could not generate a response.';
    return res.status(200).json({ reply, source: 'gemini' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
