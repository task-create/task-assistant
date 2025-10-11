// /api/ai.js
export const config = { runtime: 'nodejs' };

async function readJson(req) {
  // ... (unchanged)
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

    if (process.env.GEMINI_API_KEY) {
      const rawModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const MODEL = rawModel.replace(/^models\//, '').trim(); // Sanitize model name
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      
      // ... (rest of the fetch logic is unchanged)
    }

    // ... (fallback logic is unchanged)

  } catch (err) {
    // ... (error handling is unchanged)
  }
} 
