// /api/ai.js
export const config = { runtime: 'nodejs' };

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => (s += c));
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); }});
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // CORS + no cache
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try {
    const { prompt = '', systemPrompt = '' } = await readJson(req);

    const API_KEY = process.env.GEMINI_API_KEY;
    const MODEL   = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    if (!API_KEY) {
      return res.status(200).json({
        ok: true,
        text:
`Hi! The AI service isn't connected yet. Quick links:
• Appointment: https://bycell.co/ddncs
• Jobs: https://bycell.co/ddmtq
• Training: https://bycell.co/ddmtn
• Community resources: https://bycell.co/ddmua`
      });
    }

    const composed = systemPrompt
      ? `SYSTEM:\n${systemPrompt}\n\nUSER:\n${prompt}`
      : prompt;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${API_KEY}`;

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: composed }] }],
        generationConfig: { temperature: 0.3 }
      })
    });

    if (!r.ok) return res.status(500).json({ ok:false, error: `Gemini error: ${await r.text()}` });

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p?.text).join('')?.trim()
      || "Sorry — I couldn't generate a response right now.";
    return res.status(200).json({ ok:true, text });
  } catch (e) {
    console.error('AI route error:', e);
    return res.status(500).json({ ok:false, error: e?.message || 'Server error' });
  }
}
