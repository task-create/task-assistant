// Server route: returns ONE short nudge suggestion based on the user's last message.
// Used by the sparkle/nudge UX. Keeps it actionable and under ~16 words.

export const config = { runtime: 'nodejs20.x' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.0-flash';
  if (!GEMINI_KEY) return res.status(500).json({ ok: false, error: 'Missing GEMINI_API_KEY' });

  try {
    const { lastUserMessage = '' } = (await readJson(req)) || {};
    const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(
      GEMINI_MODEL
    )}:generateContent`;

    const prompt = [
      `User said: "${lastUserMessage}".`,
      'Return ONE short follow-up suggestion (max 16 words) that moves the task forward.',
      'Examples: "Share the city/ZIP for job search", "Paste the job posting you want to tailor".',
      'No ending period. No quotes. Be specific and helpful.',
    ].join(' ');

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8 },
      }),
    });

    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: await r.text() });
    }

    const data = await r.json();
    const suggestion =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')?.trim() || '';

    return res.status(200).json({ ok: true, suggestion });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}

async function readJson(req) {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
