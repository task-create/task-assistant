// /api/ai.js  (Node on Vercel — NOT Edge)
const KEY = process.env.GEMINI_API_KEY;
// You can set GEMINI_MODEL to "gemini-2.5-flash" or "models/gemini-2.5-flash"
const RAW_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// Normalize model for the REST URL
const MODEL = RAW_MODEL.startsWith('models/') ? RAW_MODEL : `models/${RAW_MODEL}`;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!KEY) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  try {
    const body = await readJsonBody(req);
    const { messages, system, temperature = 0.7, maxOutputTokens = 1024 } = body;

    // Convert your chat-style 'messages' into Gemini contents
    // Expecting: [{role:'user'|'assistant'|'system', content:'...'}, ...]
    const contents = [];
    if (system) {
      contents.push({
        role: 'user',
        parts: [{ text: `SYSTEM:\n${system}` }]
      });
    }
    (messages || []).forEach(m => {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }]
      });
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${encodeURIComponent(KEY)}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature, maxOutputTokens }
      })
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return res.status(resp.status).json({ error: 'Upstream model error', detail });
    }

    const data = await resp.json();
    // Extract first candidate text safely
    const reply =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';

    return res.status(200).json({ reply, raw: data });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
};
