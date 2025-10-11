// /api/ai.js
export const config = { runtime: 'edge' };

export default async function handler(req) {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const { prompt = '', systemPrompt = '' } = await req.json();

    // Accept either GOOGLE_API_KEY or GEMINI_API_KEY
    const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing GOOGLE_API_KEY' }), {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Use env model if provided, else safe default
    const model =
      (process.env.GEMINI_MODEL || '').trim() || 'gemini-1.5-flash-latest';

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${API_KEY}`;

    // Combine system + user safely as a single user role (Gemini expects 'user'/'model')
    const userText = systemPrompt
      ? `SYSTEM:\n${systemPrompt}\n\nUSER:\n${prompt}`
      : prompt;

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.6, topP: 0.95 },
      }),
    });

    if (!r.ok) {
      const body = await r.text();
      return new Response(JSON.stringify({ ok: false, error: `Gemini error ${r.status}: ${body}` }), {
        status: 502,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';

    return new Response(JSON.stringify({ ok: true, text }), {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}
