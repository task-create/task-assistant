// /api/ai.js - Vercel Serverless Function (Node.js)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY = process.env.GEMINI_API_KEY;
  const MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';
  const { message } = req.body || {};
  const userText = String(message || '').slice(0, 5000);

  if (!KEY) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent`);
  url.searchParams.set('key', KEY);

  const body = { contents: [{ role: 'user', parts: [{ text: userText }]}] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), 20000);

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(502).json({ error: 'Gemini upstream error', detail: text.slice(0, 4000) });
    }

    const data = await r.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No reply.';
    return res.status(200).json({ text: reply });
  } catch (err) {
    clearTimeout(timer);
    return res.status(500).json({ error: 'Server error', detail: String(err).slice(0, 2000) });
  }
}
