// /api/ai.js  (Edge function)
export const config = { runtime: 'edge' };

const MODEL = 'gemini-1.5-flash-latest'; // or 'gemini-1.5-pro-latest'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { prompt, systemPrompt } = await req.json();

    if (!process.env.GOOGLE_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing GOOGLE_API_KEY' }), { status: 500 });
    }
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Missing prompt' }), { status: 400 });
    }

    // Build a simple, valid payload for v1beta generateContent
    const userText = systemPrompt
      ? `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER:\n${prompt}`
      : prompt;

    const r = await fetch(`${ENDPOINT}?key=${process.env.GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: userText }] } // valid roles: user|model
        ],
        generationConfig: {
          temperature: 0.6,
          topP: 0.95,
        }
      })
    });

    if (!r.ok) {
      const body = await r.text();
      return new Response(JSON.stringify({
        ok: false,
        error: `Gemini error ${r.status}: ${body}`
      }), { status: 502 });
    }

    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';

    return new Response(JSON.stringify({ ok: true, text }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500 });
  }
}
