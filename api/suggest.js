// Returns a short, actionable follow-up suggestion based on the last user message.

export const config = { runtime: 'nodejs20.x' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.0-flash';

  if (!GEMINI_KEY) {
    return res.status(500).json({ ok: false, error: 'Missing GEMINI_API_KEY env var' });
  }

  try {
    const { lastUserMessage = '' } = req.body || {};

    const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  `User asked: "${lastUserMessage}". ` +
                  `Return ONE short suggestion (max 16 words) that nudges the user forward. ` +
                  `No punctuation at the end, no quotes.`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.8 },
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return res.status(r.status).json({ ok: false, provider: 'Gemini', error: errText });
    }

    const data = await r.json();
    const suggestion =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')?.trim() || '';
    return res.status(200).json({ ok: true, suggestion });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
