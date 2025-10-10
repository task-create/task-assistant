// Server route: real-time job search via Gemini + Google Search tool
// Returns a short, clean bullet list with direct employer links when possible.

export const config = { runtime: 'nodejs' };

// Use a more current model that's great for tool use
const GEMINI_MODEL = 'models/gemini-1.5-flash-latest';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
        console.error('Missing GEMINI_API_KEY');
        return res.status(500).json({ ok: false, error: 'Missing API Key configuration' });
    }

    try {
        const { query = '' } = await readJson(req);
        if (!query.trim()) {
            return res.status(400).json({ ok: false, error: 'Missing "query"' });
        }

        const system = [
            'You are a job search assistant for Task Employment Services (TASK). Your location is Hamilton Township, NJ.',
            'You MUST use the provided Google Search tool to find CURRENT, real job openings based on the user\'s request.',
            'Prioritize direct employer career pages over job boards (like Indeed, LinkedIn, etc.) when possible.',
            'Return a short, clean markdown bullet list (3–5 items is ideal). Each item must be formatted exactly like this:',
            '**Job Title** at Company Name - [Apply Here](URL)',
            'Keep the results highly relevant to the user\'s query, especially the location.',
            'If you cannot find any relevant jobs, state that clearly and politely, and include this specific markdown link: [TASK Job Openings](https://bycell.co/ddmtq).'
        ].join('\n');

        const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: 'user', parts: [{ text: `Find jobs for: ${query}` }] }],
                tools: [{ google_search: {} }],
                generationConfig: { temperature: 0.3 },
            }),
        });

        if (!r.ok) {
            const errorData = await r.json();
            // Log the actual error from Google for easier debugging
            console.error('Gemini API Error:', errorData); 
            return res.status(r.status).json({ ok: false, provider: 'Gemini', error: errorData });
        }

        const data = await r.json();
        // A more robust way to extract text, checking for tool calls vs. simple text response
        const text = data.candidates[0]?.content?.parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('') || `Sorry, I couldn't find any specific jobs for that search. You can always check the main [TASK Job Openings](https://bycell.co/ddmtq) board.`;

        return res.status(200).json({ ok: true, provider: 'Gemini', text });
    } catch (e) {
        console.error('Server-side error in /api/jobs:', e);
        return res.status(500).json({ ok: false, error: String(e) });
    }
}

async function readJson(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
}
