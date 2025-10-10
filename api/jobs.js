// Server route: real-time job search via Gemini + Google Search tool
export const config = { runtime: 'nodejs' };

const GEMINI_MODEL = 'models/gemini-1.5-flash-latest';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }
    
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
        console.error('SERVER ERROR: Missing GEMINI_API_KEY environment variable.');
        return res.status(500).json({ ok: false, error: 'Server configuration error: Missing API Key.' });
    }

    try {
        const { query = '' } = await readJson(req);
        if (!query.trim()) {
            return res.status(400).json({ ok: false, error: 'Bad Request: Missing "query" in body.' });
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
        
        // Note: Using the API key in the URL is a valid authentication method for this API.
        const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: 'user', parts: [{ text: `Find jobs for: ${query}` }] }],
                tools: [{ google_search: {} }],
                generationConfig: { temperature: 0.3 },
            }),
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.json();
            console.error('GEMINI API ERROR:', JSON.stringify(errorBody, null, 2));
            const errorMessage = errorBody?.error?.message || 'The AI service failed to respond.';
            return res.status(502).json({ ok: false, error: `Failed to fetch from Gemini API: ${errorMessage}` });
        }

        const data = await apiResponse.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            console.warn('GEMINI API WARNING: No candidates returned in response.');
            return res.status(200).json({ ok: true, text: `Sorry, I couldn't find any specific jobs for that search. You can always check the main [TASK Job Openings](https://bycell.co/ddmtq) board.` });
        }

        const text = data.candidates[0]?.content?.parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('') || `Sorry, I couldn't find any specific jobs for that search. You can always check the main [TASK Job Openings](https://bycell.co/ddmtq) board.`;

        return res.status(200).json({ ok: true, text: text });

    } catch (e) {
        console.error('SERVER-SIDE CRASH in /api/jobs:', e);
        return res.status(500).json({ ok: false, error: 'An unexpected error occurred on the server.' });
    }
}

async function readJson(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
}
