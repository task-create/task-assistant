// File: /api/ai.js
// Vercel Node Serverless Function (NOT Edge).
// Uses raw REST call to Gemini so you don't fight SDK/ESM issues.

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    // If Vercel already parsed body (sometimes true), use it
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function toGeminiContents(payload) {
  // Accept either { prompt: string } or { messages: [{role, content}, ...] }
  if (payload?.messages && Array.isArray(payload.messages)) {
    return payload.messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(m.content ?? '') }]
    }));
  }
  const prompt = String(payload?.prompt ?? '').trim() || 'Hello!';
  return [{ role: 'user', parts: [{ text: prompt }] }];
}

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // --- Env guard ---
  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY env var' });
  }

  try {
    const bodyIn = await readJsonBody(req);
    const contents = toGeminiContents(bodyIn);

    // IMPORTANT: model goes in the URL path (no `model` field in JSON body)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // You can add safetySettings and generationConfig if you want
      body: JSON.stringify({ contents })
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      // Surface the real upstream error so you stop seeing generic 502s
      return res.status(502).json({
        error: `Gemini upstream ${r.status}`,
        detail
      });
    }

    const data = await r.json();
    // Extract text safely (Gemini returns candidates[0].content.parts[x].text)
    let text = '';
    const c0 = data?.candidates?.[0];
    const parts = c0?.content?.parts || [];
    for (const p of parts) {
      if (typeof p?.text === 'string') text += p.text;
    }

    res.status(200).json({ text });
  } catch (err) {
    res.status(502).json({
      error: err?.message || 'Unknown server error',
      detail: String(err)
    });
  }
}
