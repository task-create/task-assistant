// api/suggest.js — short follow-up suggestion. Gemini with optional OpenAI fallback.

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
  const res = await fetch(url, {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body: JSON.stringify({ contents:[{ role:'user', parts:[{ text: prompt }]}] })
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    const err = new Error(`Gemini ${res.status} ${res.statusText}\n${text}`);
    err._isGemini = true; throw err;
  }
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
}

async function askOpenAI(prompt) {
  if (!OPENAI_KEY) throw new Error('NO_OPENAI_KEY');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'authorization':`Bearer ${OPENAI_KEY}`, 'content-type':'application/json' },
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

    const prompt = `You are a helpful assistant for a workforce app.
Given the user's last message (triple backticks), suggest ONE short, actionable follow-up they might ask next.
Keep it under 120 characters, no quotes.
\`\`\`
${base}
\`\`\``;

    let text;
    try {
      text = await askGeminiPrompt(prompt);
    } catch (e) {
      const geminiExpired = String(e?.message||'').includes('API_KEY_INVALID') || String(e?.message||'').includes('expired');
      if (geminiExpired || e._isGemini || e.message === 'NO_GEMINI_KEY') {
        if (OPENAI_KEY) text = await askOpenAI(prompt);
        else throw e;
      } else { throw e; }
    }

    res.status(200).json({ ok:true, suggestion: (text||'').trim().split('\n')[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
};
