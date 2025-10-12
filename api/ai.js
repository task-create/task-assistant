// File: /api/ai.js
// Vercel Node Serverless Function (NOT Edge). No Supabase. No KB queries.

// ---- Config (safe defaults) ----
const RAW_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// if someone sets "models/gemini-2.5-flash", strip the prefix
const MODEL = RAW_MODEL.replace(/^models\//, '').trim();
const API_KEY = process.env.GEMINI_API_KEY;

// ---- Helpers ----
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function toGeminiContents(payload) {
  // Supports: { messages: [{role:'user'|'assistant', content:string}, ...] }
  if (Array.isArray(payload?.messages)) {
    return payload.messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(m.content ?? '') }]
    }));
  }
  // Fallback: { prompt: string }
  const prompt = String(payload?.prompt ?? '').trim() || 'Hello!';
  return [{ role: 'user', parts: [{ text: prompt }] }];
}

// ---- Handler ----
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY env var' });
  }

  try {
    const bodyIn = await readJsonBody(req);
    const contents = toGeminiContents(bodyIn);

    // IMPORTANT: model goes ONLY in the URL path (NOT in the JSON body)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Add generationConfig/safetySettings here if needed
      body: JSON.stringify({ contents })
    });

    // Bubble up the real upstream error (helps debugging)
    if (!upstream.ok) {
      const detailText = await upstream.text().catch(() => '');
      return res.status(502).json({
        error: `Gemini upstream ${upstream.status}`,
        detail: detailText,
        debug: { modelUsed: MODEL }
      });
    }

    const data = await upstream.json();

    // Extract plain text from candidates[0].content.parts[].text
    let text = '';
    const parts = data?.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      if (typeof p?.text === 'string') text += p.text;
    }

    return res.status(200).json({ text, model: MODEL });
  } catch (err) {
    return res.status(502).json({
      error: err?.message || 'Unknown server error',
      detail: String(err),
      debug: { modelUsed: MODEL }
    });
  }
}
