// Serverless handler for chat replies (Gemini-first, optional OpenAI fallback)

export const config = { runtime: 'nodejs20.x' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.0-flash';

  if (!GEMINI_KEY) {
    return res.status(500).json({ ok: false, error: 'Missing GEMINI_API_KEY env var' });
  }

  try {
    const { prompt = '', history = [] } = req.body || {};

    // Convert our simple history to Gemini "contents"
    const contents = [];
    for (const m of history) {
      contents.push({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text ?? '' }],
      });
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // <-- This header is REQUIRED. If it’s missing, you get the 403 you’re seeing.
        'x-goog-api-key': GEMINI_KEY,
      },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.6 },
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return res.status(r.status).json({ ok: false, provider: 'Gemini', error: errText });
    }

    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '(no response)';
    return res.status(200).json({ ok: true, provider: 'Gemini', text });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
