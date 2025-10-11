export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try {
    const { prompt: userPrompt, systemPrompt } = await readJson(req);

    // ✅ Accept env like "gemini-2.0-flash", "gemini-1.5-flash", etc.
    //    and tolerate someone setting "models/gemini-2.0-flash"
    const RAW = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const MODEL = RAW.replace(/^models\//i, '').trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const body = {
      // model is NOT included here for this endpoint
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: userPrompt || '' }] }],
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await r.json();

    if (!r.ok) {
      // Surface Google’s error cleanly
      return res.status(500).json({ ok:false, error:`Gemini error: ${JSON.stringify(data, null, 2)}` });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';

    return res.status(200).json({ ok:true, text });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8') || '{}';
  return JSON.parse(raw);
}
