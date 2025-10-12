// /api/ai.js
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// IMPORTANT: bare model name (no "models/" prefix)
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages = [{ role: 'user', content: 'Hello' }] } = await readJsonBody(req);
  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  try {
    const result = await ai.models.generateContent({ model: MODEL, contents });
    // Depending on SDK version, you may need result.response.text()
    const text = result.text ?? result.response?.text?.() ?? '';
    res.status(200).json({ text });
  } catch (err) {
    // Surface the true 400 so the client stops showing a generic 502
    res.status(502).json({ error: err?.message, detail: err?.response?.data || String(err) });
  }
}
