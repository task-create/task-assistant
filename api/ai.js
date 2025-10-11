// /api/ai.js
export const config = { runtime: 'nodejs' };

async function readJson(req) {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8') || '{}';
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const { prompt = '', systemPrompt = '' } = await readJson(req);

    const apiKey = process.env.GEMINI_API_KEY;
    const rawModel = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').replace(/^models\//, '').trim();
    if (!apiKey) {
      const fallback = "Thanks for your message. I’m not connected to the AI service yet. Please add GEMINI_API_KEY to the environment.";
      return res.status(200).json({ ok: true, text: fallback });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(rawModel)}:generateContent?key=${apiKey}`;
    const body = {
      contents: [
        ...(systemPrompt
          ? [{ role: 'system', parts: [{ text: systemPrompt }] }]
          : []),
        { role: 'user', parts: [{ text: String(prompt || '') }] },
      ],
      generationConfig: {
        temperature: 0.5,
      },
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(502).json({ ok: false, error: `Gemini error ${r.status}: ${errText}` });
    }

    const json = await r.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') ||
      json?.candidates?.[0]?.output_text ||
      '';

    if (!text) return res.status(200).json({ ok: true, text: "I couldn't generate a response." });
    return res.status(200).json({ ok: true, text });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
  }
}
