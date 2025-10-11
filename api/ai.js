// /api/ai.js
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405 });
    }

    const { prompt, systemPrompt } = await req.json();

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing GEMINI_API_KEY' }), { status: 500 });
    }
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Missing prompt' }), { status: 400 });
    }

    const model = 'gemini-1.5-flash'; // change to gemini-1.5-pro if you prefer
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    // VALID ROLES ONLY: "user" and "model"
    const body = {
      system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!r.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `Gemini error ${r.status}: ${JSON.stringify(data)}` }),
        { status: 502 }
      );
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';

    return new Response(JSON.stringify({ ok: true, text }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500 });
  }
}
