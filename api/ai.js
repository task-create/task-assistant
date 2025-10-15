// /api/ai.js  (Vercel Node function)
const fetch = require('node-fetch');

const KEY = process.env.GEMINI_API_KEY;
const RAW_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const MODEL = RAW_MODEL.startsWith("models/") ? RAW_MODEL : `models/${RAW_MODEL}`;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let data = "";
    req.on("data", c => (data += c));
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!KEY) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

  try {
    const body = await readJsonBody(req);
    console.log("[/api/ai] received body:", JSON.stringify(body)); // Vercel logs

    let { messages, system, prompt, input, temperature = 0.7, maxOutputTokens = 1024 } = body;

    // Build Gemini contents
    const contents = [];
    if (system) contents.push({ role: "user", parts: [{ text: `SYSTEM:\n${String(system)}` }] });

    if (Array.isArray(messages) && messages.length) {
      for (const m of messages) {
        contents.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: String(m.content ?? "") }]
        });
      }
    } else {
      const text = String(prompt ?? input ?? "").trim();
      if (!text) return res.status(400).json({ error: "Missing prompt or messages", saw: body });
      contents.push({ role: "user", parts: [{ text }] });
    }

    const hasAnyText = contents.some(c => c.parts?.some(p => (p.text || "").trim()));
    if (!hasAnyText) return res.status(400).json({ error: "Empty after normalization", saw: body });

    const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${encodeURIComponent(KEY)}`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature, maxOutputTokens }
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(upstream.status).json({ error: "Upstream model error", detail });
    }

    const data = await upstream.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    return res.status(200).json({ reply, raw: data });
  } catch (e) {
    console.error("AI handler error:", e?.message || e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
};

