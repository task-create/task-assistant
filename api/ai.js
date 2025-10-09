// File: /api/ai.js
// Vercel serverless function that proxies requests to Google Gemini

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const KEY = process.env.GEMINI_API_KEY;
    const MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';

    if (!KEY) {
      console.error('Missing GEMINI_API_KEY in environment.');
      return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    }

    // Expect JSON: { message: "..." }
    const { message } = req.body || {};
    const userText = String(message || '').slice(0, 5000);

    if (!userText) {
      return res.status(400).json({ error: 'Request must include "message"' });
    }

    // Build Gemini request
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent`
    );
    url.searchParams.set('key', KEY);

    const body = {
      contents: [{ role: 'user', parts: [{ text: userText }]}],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 800
      }
    };

    // Call Gemini
    const upstream = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('Gemini upstream error', upstream.status, detail);
      return res.status(502).json({
        error: 'Upstream error',
        detail: detail.slice(0, 2000)
      });
    }

    const data = await upstream.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No reply.';

    return res.status(200).json({ text: reply });
  } catch (err) {
    console.error('Function crash:', err);
    return res
      .status(500)
      .json({ error: 'Server error', detail: String(err).slice(0, 1000) });
  }
}
