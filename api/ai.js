// /api/ai.js
// Vercel Node serverless (NOT Edge). Handles Gemini with OpenAI fallback.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';
const GEMINI_KEY   = process.env.GEMINI_API_KEY;

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_KEY   = process.env.OPENAI_API_KEY;

// ---------- helpers ----------
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function askGemini(prompt, history = []) {
  if (!GEMINI_KEY) throw new Error('NO_GEMINI_KEY');
  const contents = [
    ...history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text || '' }]
    })),
    { role: 'user', parts: [{ text: prompt || '' }] }
  ];
  const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents })
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    const err = new Error(`Gemini ${res.status} ${res.statusText}\n${text}`);
    err._isGemini = true;
    throw err;
  }
  const json = await res.json();
  const out = json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  return out || '(no content returned)';
}

async function askOpenAI(prompt, history = []) {
  if (!OPENAI_KEY) throw new Error('NO_OPENAI_KEY');
  // convert history to OpenAI format
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.text || '' })),
    { role: 'user', content: prompt || '' }
  ];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${OPENAI_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.7
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    throw new Error(`OpenAI ${res.status} ${res.statusText}\n${text}`);
  }
  const json = await res.json();
  const out = json?.choices?.[0]?.message?.content || '';
  return out || '(no content returned)';
}

// ---------- handler ----------
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try {
    const { prompt, history } = await readJsonBody(req);
    if (!prompt || typeof prompt !== 'string')
      return res.status(400).json({ ok:false, error:'Missing "prompt" (string)' });

    let text;
    try {
      text = await askGemini(prompt, Array.isArray(history) ? history : []);
    } catch (e) {
      // If Gemini key is expired/invalid, gracefully fallback to OpenAI if available
      const geminiExpired = String(e?.message || '').includes('API key expired') ||
                            String(e?.message || '').includes('API_KEY_INVALID');
      if (geminiExpired || e.message === 'NO_GEMINI_KEY' || e._isGemini) {
        if (OPENAI_KEY) {
          text = await askOpenAI(prompt, Array.isArray(history) ? history : []);
        } else {
          throw e; // no fallback available
        }
      } else {
        throw e;
      }
    }

    res.status(200).json({ ok:true, text, provider: (text && OPENAI_KEY && !GEMINI_KEY) ? 'openai' : 'gemini-or-openai' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
};
// /api/suggest.js
// Creates a short follow-up suggestion based on the last user message.
// Uses the same Gemini→OpenAI fallback strategy as /api/ai.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';
const GEMINI_KEY   = process.env.GEMINI_API_KEY;

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_KEY   = process.env.OPENAI_API_KEY;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch(e){ reject(e); } });
    req.on('error', reject);
  });
}

async function askGeminiPrompt(prompt) {
  if (!GEMINI_KEY) throw new Error('NO_GEMINI_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const body = {
    contents: [{ role:'user', parts:[{ text: prompt }]}]
  };
  const res = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    const err = new Error(`Gemini ${res.status} ${res.statusText}\n${text}`);
    err._isGemini = true;
    throw err;
  }
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
}

async function askOpenAI(prompt) {
  if (!OPENAI_KEY) throw new Error('NO_OPENAI_KEY');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${OPENAI_KEY}`, 'content-type':'application/json' },
    body: JSON.stringify({ model: OPENAI_MODEL, messages:[{ role:'user', content: prompt }], temperature: 0.7 })
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    throw new Error(`OpenAI ${res.status} ${res.statusText}\n${text}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try {
    const { lastUserMessage } = await readJsonBody(req);
    const base = (lastUserMessage || '').slice(0, 800);

    const prompt = `You are a helpful assistant for a workforce development app.
Given the user's last message (triple backticks), suggest ONE short follow-up they might ask next.
Keep it under 120 characters, actionable, and specific. Do not add quotes or extra text.
\`\`\`
${base}
\`\`\``;

    let text;
    try {
      text = await askGeminiPrompt(prompt);
    } catch (e) {
      const geminiExpired = String(e?.message || '').includes('API key expired') ||
                            String(e?.message || '').includes('API_KEY_INVALID');
      if (geminiExpired || e.message === 'NO_GEMINI_KEY' || e._isGemini) {
        if (OPENAI_KEY) text = await askOpenAI(prompt);
        else throw e;
      } else {
        throw e;
      }
    }

    // return only one line
    res.status(200).json({ ok:true, suggestion: (text || '').trim().split('\n')[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
};
