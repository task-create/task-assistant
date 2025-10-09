// File: api/ai.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'Missing GEMINI_API_KEY on server' });

  try {
    const { message } = req.body || {};
    const MODEL = 'models/gemini-2.5-flash';
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent`);
    url.searchParams.set('key', KEY);

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: String(message || '') }]}] })
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: 'Gemini upstream error', detail });
    }

    const data = await r.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No reply.';
    res.status(200).json({ text: reply });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
