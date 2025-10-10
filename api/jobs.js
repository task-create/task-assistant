// Server route: real-time job search via Gemini + Google Search tool
// Returns a short, clean bullet list with direct employer links when possible.

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.0-flash';
  if (!GEMINI_KEY) return res.status(500).json({ ok: false, error: 'Missing GEMINI_API_KEY' });

  try {
    const { query = '' } = (await readJson(req)) || {};
    if (!query.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing "query"' });
    }

    const system = [
      'You are a job search assistant for Task Employment Services (TASK).',
      'Use the Google Search tool to find CURRENT, relevant openings for the user request.',
      'Prioritize direct employer career pages over job boards when possible.',
      'Output format: a short markdown bullet list (3–6 items). Each item:',
      '- Job Title — Employer — [Apply Here](URL)',
      'Keep it concise and relevant to the query and location, if provided.',
      'If nothing solid is found, say so briefly and include: [TASK Job Openings](https://bycell.co/ddmtq).'
    ].join('\n');

    const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(
      GEMINI_MODEL
    )}:generateContent`;

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: `Find jobs for: ${query}` }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.3 },
      }),
    });

    if (!r.ok) {
      return res.status(r.status).json({ ok: false, provider: 'Gemini', error: await r.text() });
    }

    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
      `Sorry, I couldn't find solid results for your search. Check the [TASK Job Openings](https://bycell.co/ddmtq).`;

    return res.status(200).json({ ok: true, provider: 'Gemini', text });
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
