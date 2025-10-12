// /api/ai.js  (Node serverless, not Edge)
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// Use a valid, current model name (examples below)
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'; // or 'gemini-2.5-flash' / 'gemini-2.5-flash-lite'

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { messages = [{ role: 'user', content: 'Hello' }] } = await readJsonBody(req);

  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  try {
    const result = await ai.models.generateContent({ model: MODEL, contents });
    res.status(200).json({ text: result.text });
  } catch (err) {
    res.status(502).json({ error: err?.message, detail: err?.response?.data || String(err) });
  }
}
