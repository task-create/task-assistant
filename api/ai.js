// /api/ai.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve, reject) => {
    let s = ''; req.on('data', c => s += c);
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function kbLookup(q) {
  const cleaned = q.trim();

  // 1) Exact-ish
  let query = SUPABASE.from('knowledge_base')
    .select('answer,priority')
    .ilike('question', cleaned)
    .order('priority', { ascending: false })
    .limit(1);
  let { data, error } = await query;
  if (error) console.error('KB exact error', error);
  if (data?.[0]?.answer) return data[0].answer;

  // 2) Substring match in question/tags
  ({ data, error } = await SUPABASE
    .from('knowledge_base')
    .select('answer,priority')
    .or(`question.ilike.%${cleaned}%,tags.ilike.%${cleaned}%`)
    .order('priority', { ascending: false })
    .limit(1));
  if (error) console.error('KB ilike error', error);
  if (data?.[0]?.answer) return data[0].answer;

  // 3) Very simple fallback: look by category keywords
  const cat = /train(ing|ings|class|culinary|sora|forklift)|job|opening|apply|event|workshop|resource|housing|food|legal/i;
  if (cat.test(cleaned)) {
    ({ data, error } = await SUPABASE
      .from('knowledge_base')
      .select('answer,priority')
      .ilike('category', `%${cleaned}%`)
      .order('priority', { ascending: false })
      .limit(1));
    if (!error && data?.[0]?.answer) return data[0].answer;
  }

  return null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { prompt } = await readBody(req);
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    // --- SUPABASE FIRST ---
    const kb = await kbLookup(prompt);
    if (kb) return res.status(200).json({ reply: kb, source: 'kb' });

    // --- GEMINI FALLBACK ---
    if (!GEMINI_KEY) {
      return res.status(200).json({
        reply: "I couldn't find this in the knowledge base, and the AI key isn't set.",
        source: 'none'
      });
    }

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }]}]
        })
      }
    );
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ reply: 'Upstream model error.', detail: t, source: 'gemini' });
    }
    const j = await r.json();
    const reply = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || 'Sorry, no answer.';
    return res.status(200).json({ reply, source: 'gemini' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
