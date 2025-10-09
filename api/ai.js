// /api/ai.js
// Vercel Node Serverless Function (NOT Edge)

const MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';
const KEY   = process.env.GEMINI_API_KEY;

// --- helpers ---
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function askGemini(prompt, history = []) {
  if (!KEY) {
    // Fallback for local dev / missing key
    return `Echo (no GEMINI_API_KEY set): ${prompt}`;
  }

  // Convert history [{role:'user'|'assistant', text:'...'}] to Gemini "contents"
  const historyContents = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text || '' }],
  }));

  const body = {
    contents: [
      ...historyContents,
      { role: 'user', parts: [{ text: prompt || '' }] }
    ],
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(()=>'');
    throw new Error(`Gemini ${res.status} ${res.statusText}\n${text}`);
  }

  const json = await res.json();
  const out = json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  return out || '(no content returned)';
}

// --- handler ---
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const { prompt, history } = await readJsonBody(req);
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing "prompt" (string)' });
      return;
    }
    const text = await askGemini(prompt, Array.isArray(history) ? history : []);
    res.status(200).json({ ok: true, text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
