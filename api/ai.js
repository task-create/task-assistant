// /api/ai.js
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const key = process.env.GEMINI_KEY; // set in Vercel
    if (!key) return res.status(500).json({ error: 'Missing GEMINI_KEY' });

    const { message } = await req.json?.() || req.body || {};
    if (!message) return res.status(400).json({ error: 'Missing message' });

    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    url.searchParams.set('key', key);

    const body = { contents: [{ role: 'user', parts: [{ text: message }]}] };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'upstream_error', detail: text.slice(0,1000) });
    }

    const data = await r.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No reply.';
    res.status(200).json({ text: reply });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String(e).slice(0,1000) });
  }
}
