// /api/ai.js
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  // CORS for cross-origin previews
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const body = await readJson(req);
    const { prompt = '', systemPrompt = '' } = body || {};
    return res.status(200).json({
      ok: true,
      text: `✅ API alive. You sent: "${prompt.slice(0, 80)}" (systemPrompt length: ${systemPrompt.length})`,
    });
  } catch (e) {
    console.error('ai.js error:', e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
