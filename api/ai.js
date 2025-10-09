// File: api/ai.js
// Vercel Serverless Function (Node.js runtime)
// Frontend calls: fetch('/api/ai', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message }) })

const MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';
const KEY   = process.env.GEMINI_API_KEY;

// Keep outputs focused on TASK (Trenton Area Soup Kitchen) services
const TASK_POLICY = `
You are "Employment Assistant" for Trenton Area Soup Kitchen (TASK).
Focus on: getting ready for work, finding work, keeping work.
Prefer verified, official resources and TASK services.

Assume:
- Address: 72 Escher St, Trenton, NJ 08609
- Phones: Employment Services 609-697-6215, Employment Training 609-697-6166, Appointments 609-337-1624
- Site: https://trentonsoupkitchen.org/
- Job search & assistance: https://trentonsoupkitchen.org/job-search-and-assistance/
- Creative Arts: https://trentonsoupkitchen.org/creative-arts-program/

Do NOT provide legal/medical/financial advice; suggest contacting TASK staff or official agencies when needed.
Be concise, structured, and use bullet points when helpful.
`;

// If your frontend is same-origin (recommended), this can be strict.
// If you're calling from a different domain (e.g., GitHub Pages), put that origin here.
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",       // tighten to your domain if possible
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default async function handler(req, res) {
  try {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.set(corsHeaders(req.headers.origin));
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      res.set(corsHeaders(req.headers.origin));
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!KEY) {
      res.set(corsHeaders(req.headers.origin));
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY on server' });
    }

    // Parse input
    let message = '';
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      message = String(body?.message || '').slice(0, 5000);
    } catch {
      res.set(corsHeaders(req.headers.origin));
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    if (!message) {
      res.set(corsHeaders(req.headers.origin));
      return res.status(400).json({ error: 'message is required' });
    }

    // Build Gemini request
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent`
    );
    url.searchParams.set('key', KEY);

    const payload = {
      systemInstruction: {
        role: "system",
        parts: [{ text: TASK_POLICY }]
      },
      contents: [
        { role: "user", parts: [{ text: message }] }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024
      }
    };

    // Timeout guard (20s)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 20000);

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    }).catch(err => ({ ok: false, statusText: String(err) }));

    clearTimeout(timer);

    if (!r?.ok) {
      const detail = typeof r.text === 'function' ? await r.text() : String(r.statusText || 'Unknown error');
      res.set(corsHeaders(req.headers.origin));
      return res.status(502).json({ error: 'Gemini upstream error', detail: detail.slice(0, 1000) });
    }

    const data = await r.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Sorry — I could not find a good answer.';

    res.set(corsHeaders(req.headers.origin));
    return res.status(200).json({ text: reply });
  } catch (err) {
    res.set(corsHeaders(req.headers.origin));
    return res.status(500).json({ error: 'Server error', detail: String(err).slice(0, 1000) });
  }
}
