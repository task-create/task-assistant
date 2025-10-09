// File: /api/ai.js
// Vercel Node Serverless Function (NOT Edge). Uses res.setHeader, not res.set.

const MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';
const KEY   = process.env.GEMINI_API_KEY;

// Small helper to read JSON body safely (works whether Vercel gives string or object)
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // Preflight
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!KEY) {
    res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const userText = String(body?.message || '').slice(0, 5000);

    // Build Gemini URL
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent`
    );
    url.searchParams.set('key', KEY);

    // Ask for concise, bullet-friendly answers biased to TASK topics
    const systemPreamble =
      'You are Employment Assistant for Trenton Area Soup Kitchen (TASK). ' +
      'Be brief and actionable. Use bullet points when listing. ' +
      'Prefer TASK resources and official sites.';

    const payload = {
      contents: [
        { role: 'user', parts: [{ text: `${systemPreamble}\n\nUser: ${userText}` }] }
      ]
    };

    const upstream = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      res.status(502).json({
        error: 'Upstream error',
        detail: detail.slice(0, 2000)
      });
      return;
    }

    const data = await upstream.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No reply.';

    res.status(200).json({ text: reply });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: String(err).slice(0, 2000) });
  }
};
