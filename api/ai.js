// /api/ai.js — generic chat/generation endpoint
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.0-flash';
  if (!GEMINI_KEY) {
    return res.status(500).json({ ok: false, error: 'Missing GEMINI_API_KEY' });
  }

  try {
    const { prompt = '', systemPrompt = '' } = await readJson(req);

    const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(
      GEMINI_MODEL
    )}:generateContent`;

    const body = {
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6 }
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      return res.status(r.status).json({ ok: false, provider: 'Gemini', error: await r.text() });
    }

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return res.status(200).json({ ok: true, text });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
