// /api/ai.js
// Order: Tier-0 (hardcoded) -> Tier-1 (Supabase) -> Tier-2 (Gemini translation/fallback)

import fetch from "node-fetch";
import { matchHardcoded } from "../data/hardcoded.js";

const getEnv = (k, d=null) => process.env[k] ?? d;

async function geminiGenerateText({ apiKey, model, text }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ contents: [{ role:"user", parts:[{ text }] }] })
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const j = await r.json();
  return j?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function detectLang(s="") {
  const t = s.toLowerCase();
  const looksES = /\b(hola|gracias|por favor|necesito|trabajo|entrevista|curriculum|curso)\b/.test(t);
  const looksHT = /\b(bonj(ou|o)r|mwen|ou|ki jan|mèsi|travay|entèvyou|rezime)\b/.test(t);
  if (looksES) return "es";
  if (looksHT) return "ht";
  return "en";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error:"Missing prompt" });

    const SUPABASE_URL = getEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = getEnv("SUPABASE_ANON_KEY");
    const GEMINI_API_KEY = getEnv("GEMINI_API_KEY");
    const GEMINI_MODEL = getEnv("GEMINI_MODEL", "gemini-2.5-flash");

    // --- language: English default; only switch if the user starts in ES/HT
    const userLang = detectLang(prompt); // 'en' | 'es' | 'ht'

    // ---------- TIER 0: HARDCODED ----------
    // (Transit flow can optionally pass origin/destination from the UI; not needed here.)
    const hard = matchHardcoded(prompt, {});
    if (hard?.html) {
      let html = hard.html;
      // translate Tier-0 if user began in Spanish/Haitian
      if ((userLang === "es" || userLang === "ht") && GEMINI_API_KEY) {
        const tag = userLang === "es" ? "Spanish" : "Haitian Creole";
        const translated = await geminiGenerateText({
          apiKey: GEMINI_API_KEY,
          model: GEMINI_MODEL,
          text: `Translate the following message into ${tag}. Preserve URLs and phone numbers:\n\n${html}`
        }).catch(()=> null);
        if (translated) html = translated;
      }
      return res.status(200).json({ text: html, source: `hardcoded:${hard.id}` });
    }

    // ---------- TIER 1: SUPABASE ----------
    // trainings
    const supHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
    const tResp = await fetch(`${SUPABASE_URL}/rest/v1/trainings?select=*`, { headers: supHeaders });
    const trainings = tResp.ok ? await tResp.json() : [];
    const tMatch = trainings.find(t => prompt.toLowerCase().includes((t.name||"").toLowerCase()));
    if (tMatch) {
      let text = [
        `📋 ${tMatch.name}`,
        tMatch.description || "",
        tMatch.schedule ? `Schedule: ${tMatch.schedule}` : "",
        tMatch.duration ? `Duration: ${tMatch.duration}` : "",
        tMatch.next_start_date ? `Next start date: ${tMatch.next_start_date}` : "Next start date: TBD",
        tMatch.signup_link ? `Sign up: ${tMatch.signup_link}` : "",
        tMatch.contact_info ? `Contact: ${tMatch.contact_info}` : ""
      ].filter(Boolean).join("\n");
      if ((userLang === "es" || userLang === "ht") && GEMINI_API_KEY) {
        const tag = userLang === "es" ? "Spanish" : "Haitian Creole";
        text = await geminiGenerateText({
          apiKey: GEMINI_API_KEY, model: GEMINI_MODEL,
          text: `Translate into ${tag}. Keep links and numbers as-is:\n\n${text}`
        }).catch(()=> text);
      }
      return res.status(200).json({ text, source: "supabase:trainings" });
    }

    // jobs
    const jResp = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=*`, { headers: supHeaders });
    const jobs = jResp.ok ? await jResp.json() : [];
    const jMatch = jobs.find(j =>
      prompt.toLowerCase().includes((j.name||j.title||"").toLowerCase())
    );
    if (jMatch) {
      let text = [
        `💼 ${jMatch.name || jMatch.title}${jMatch.company ? " at " + jMatch.company : ""}`,
        jMatch.description || "",
        jMatch.location ? `Location: ${jMatch.location}` : "",
        jMatch.apply_link ? `Apply: ${jMatch.apply_link}` : "",
        "If you need help with applications or interviews, call (609) 337-1624."
      ].filter(Boolean).join("\n");
      if ((userLang === "es" || userLang === "ht") && GEMINI_API_KEY) {
        const tag = userLang === "es" ? "Spanish" : "Haitian Creole";
        text = await geminiGenerateText({
          apiKey: GEMINI_API_KEY, model: GEMINI_MODEL,
          text: `Translate into ${tag}. Keep links and numbers as-is:\n\n${text}`
        }).catch(()=> text);
      }
      return res.status(200).json({ text, source: "supabase:jobs" });
    }

    // resources
    const rResp = await fetch(`${SUPABASE_URL}/rest/v1/resources?select=*`, { headers: supHeaders });
    const resources = rResp.ok ? await rResp.json() : [];
    const rMatch = resources.find(r => prompt.toLowerCase().includes((r.name||"").toLowerCase()));
    if (rMatch) {
      let text = [
        `🧭 ${rMatch.name}`,
        rMatch.category ? `Category: ${rMatch.category}` : "",
        rMatch.description || "",
        rMatch.website || "",
        rMatch.phone_number || ""
      ].filter(Boolean).join("\n");
      if ((userLang === "es" || userLang === "ht") && GEMINI_API_KEY) {
        const tag = userLang === "es" ? "Spanish" : "Haitian Creole";
        text = await geminiGenerateText({
          apiKey: GEMINI_API_KEY, model: GEMINI_MODEL,
          text: `Translate into ${tag}. Keep links and numbers as-is:\n\n${text}`
        }).catch(()=> text);
      }
      return res.status(200).json({ text, source: "supabase:resources" });
    }

    // ---------- TIER 2: GEMINI ----------
    const gText = await geminiGenerateText({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      text: `You are Solace, a warm and kind assistant for TASK (Trenton Area Soup Kitchen).
Answer concisely. If the question is about appointments, trainings, resources, or jobs, prefer TASK context.
If you are unsure, say you are unsure and suggest calling TASK.

User: ${prompt}`
    });

    return res.status(200).json({
      text: gText || "Sorry — I couldn’t find that. Please call TASK at (609)-695-5456.",
      source: "gemini"
    });

  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Upstream error", detail: String(err) });
  }
}
