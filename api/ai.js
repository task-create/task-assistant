// /api/ai.js
// Combines Gemini + Supabase knowledge for TASK programs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash").replace(/^models\//, "").trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); } catch (e) { reject(e); }
    });
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt } = await readJson(req);
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // 1️⃣ Check Supabase for TASK program match
    const { data: trainings } = await supabase
      .from("trainings")
      .select("name, description, next_start_date, signup_link, contact_info")
      .eq("is_active", true);

    let found = null;
    if (trainings) {
      const lower = prompt.toLowerCase();
      found = trainings.find(t =>
        lower.includes((t.name || "").toLowerCase().split(" ")[0]) ||
        lower.includes((t.name || "").toLowerCase())
      );
    }

    if (found) {
      // format nice reply
      return res.status(200).json({
        text: `📋 **${found.name}**\n\n${found.description || "No description available."}\n\nNext Start Date: ${found.next_start_date || "TBA"}\n\nSign-Up: ${found.signup_link || "Contact TASK for details"}\n\n📞 ${found.contact_info || "Call TASK Workforce Development Office"}`
      });
    }

    // 2️⃣ Otherwise ask Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const detailText = await upstream.text();
    if (!upstream.ok) {
      return res.status(502).json({
        error: `Gemini upstream ${upstream.status}`,
        detail: detailText,
      });
    }

    const data = JSON.parse(detailText);
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join(" ") || "(no response)";
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
  
}
