// /api/ai.js  — Vercel Node Function (NOT Edge)
// Purpose: accept ANY body style; never 400 for "Missing prompt" during dev.

const BUILD = "ai.compat.v1";

function readAnyBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => (data += c));
    req.on("end", () => resolve({ raw: data, ctype: (req.headers["content-type"]||"").toLowerCase() }));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("X-Build", BUILD);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed", build: BUILD });

  try {
    const { raw, ctype } = await readAnyBody(req);
    let parsed = null;
    if (ctype.includes("application/json")) {
      try { parsed = JSON.parse(raw || "{}"); } catch {}
    } else if (ctype.includes("application/x-www-form-urlencoded")) {
      const p = new URLSearchParams(raw || "");
      parsed = Object.fromEntries(p.entries());
    } else {
      // if plain text, treat as the prompt
      if (raw && raw.trim()) parsed = { prompt: raw.trim() };
    }
    parsed = parsed || {};

    // ALSO accept query ?prompt= or ?q=
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qp = url.searchParams.get("prompt") || url.searchParams.get("q") || "";

    // Coerce a single prompt from many shapes
    const firstMsg = Array.isArray(parsed.messages) && parsed.messages[0] && (parsed.messages[0].content ?? "");
    const prompt = String(
      parsed.prompt ??
      parsed.input ??
      firstMsg ??
      qp ??
      ""
    ).trim();

    // DEV MODE: never hard-fail—if empty, reply with a hint instead of 400
    if (!prompt) {
      return res.status(200).json({
        reply: "Hi! I didn’t receive any text. Make sure you POST JSON like {\"prompt\":\"hello\"}.",
        debug: { build: BUILD, ctype, rawSnippet: (raw||"").slice(0,200), parsed }
      });
    }

    // ──────────────────────────────────────────────────────────
    // (1) ECHO BACK (prove we parsed it). Then wire Gemini.
    // ──────────────────────────────────────────────────────────
    // Return immediately so you can confirm the client → server payload path.
    return res.status(200).json({
      reply: `Echo: ${prompt}`,
      build: BUILD,
      saw: { ctype, parsedShape: Object.keys(parsed) }
    });

    // ───────────────── OPTIONAL: add Gemini after echo is confirmed ───────────────
    // const KEY = process.env.GEMINI_API_KEY;
    // const RAW_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    // const MODEL = RAW_MODEL.startsWith("models/") ? RAW_MODEL : `models/${RAW_MODEL}`;
    // if (!KEY) return res.status(500).json({ error: "Missing GEMINI_API_KEY", build: BUILD });
    // const contents = [{ role: "user", parts: [{ text: prompt }] }];
    // const urlGL = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${encodeURIComponent(KEY)}`;
    // const upstream = await fetch(urlGL, {
    //   method: "POST", headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } })
    // });
    // if (!upstream.ok) return res.status(upstream.status).json({ error:"Upstream model error", detail: await upstream.text(), build: BUILD });
    // const data = await upstream.json();
    // const reply = data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("") || "";
    // return res.status(200).json({ reply, build: BUILD });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e), build: BUILD });
  }
};
