// /api/ai.js
export const config = { runtime: 'nodejs' };

function readJson(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); }
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try {
    const { prompt = '', systemPrompt = '', language = 'en' } = await readJson(req);

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({ ok:true, text:
        (language === 'es'
          ? "Gracias por tu mensaje. Todavía no estoy conectado al servicio de IA."
          : "Thanks for your message. I’m not connected to the AI service yet.")
      });
    }

    const rawModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const MODEL = rawModel.replace(/^models\//, '').trim(); // <-- fixes “unexpected model name format”
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const sys = `${systemPrompt}\n\nRespond in ${language === 'es' ? 'Spanish' : 'English'} unless the user explicitly requests another language.`;

    const body = {
      contents: [{ role: 'user', parts: [{ text: `${sys}\n\nUSER:\n${prompt}` }] }],
      generationConfig: { temperature: 0.7 }
    };

    const r = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();

    if (!r.ok) {
      // Normalize Gemini error to your frontend
      return res.status(500).json({ ok:false, error:`Gemini error: ${JSON.stringify(j)}` });
    }

    const text = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return res.status(200).json({ ok:true, text: text || (language==='es' ? "Lo siento, no pude generar una respuesta." : "Sorry, I couldn’t generate a response.") });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, error: err.message || 'Unknown error' });
  }
}
