// /api/ai.js
export const config = { runtime: 'nodejs' };

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { return {}; }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try {
    const { prompt = '', systemPrompt = '' } = await readJson(req);

    if (!process.env.GEMINI_API_KEY) {
      const friendly = "Thanks for your message. I’m not connected to the AI service yet. Please set GEMINI_API_KEY.";
      return res.status(200).json({ ok:true, text: friendly });
    }

    const rawModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const MODEL = rawModel.replace(/^models\//, '').trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const body = {
      contents: [
        ...(systemPrompt ? [{ role: "user", parts: [{ text: `SYSTEM:\n${systemPrompt}` }] }] : []),
        { role: "user", parts: [{ text: prompt }] }
      ],
      generationConfig: { temperature: 0.7, topP: 0.95 }
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('Gemini API Error:', data);
      return res.status(500).json({ ok:false, error:`Gemini error: ${JSON.stringify(data, null, 2)}` });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm sorry, I couldn't generate a response.";

    return res.status(200).json({ ok:true, text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, error: err?.message || 'Unknown error' });
  }
}
