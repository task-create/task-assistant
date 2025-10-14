// /api/ai.js
// Vercel Node Serverless Function
const fetch = global.fetch;

// IMPORTANT: Set these in your hosting environment (e.g., Vercel Project Settings)
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const KEY   = process.env.GEMINI_API_KEY;

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*'); // Or lock down to your domain
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }
  if (!KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
  }

  try {
    const body = req.body;
    
    // Construct the payload for the Google API
    const payload = body?.contents ? body : {
      contents: [
        { role: 'user', parts: [{ text: body?.prompt ?? 'Hello' }] }
      ]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
    
    const upstreamResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await upstreamResponse.json();

    if (!upstreamResponse.ok) {
        console.error('Upstream API Error:', data);
        return res.status(upstreamResponse.status).json({ error: 'Error from Gemini API', details: data });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Server-side error:', err);
    return res.status(502).json({ error: 'Server-side processing failed.', detail: String(err) });
  }
};
