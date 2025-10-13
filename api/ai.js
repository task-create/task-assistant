// /api/ai.js
// Order: Tier-0 (hardcoded with wh-answers) -> Tier-1 (Supabase) -> Tier-2 (Gemini)

import fetch from "node-fetch";
import { matchHardcoded, classifyTrainingQ, answerBank } from "../data/hardcoded.js";

const getEnv = (k, d=null) => process.env[k] ?? d;

async function geminiGenerateText({ apiKey, model, text }) {
  if (!apiKey) return "";
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

function linkifyPhonesAndUrls(s="") {
  return s; // UI already linkifies; keep server clean
}

function section(label, value) { return value ? `**${label}:** ${value}\n` : ""; }

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

    const userLang = detectLang(prompt); // 'en' | 'es' | 'ht'

    // ---------- TIER 0: HARDCODED ----------
    const hard = matchHardcoded(prompt, {});
    if (hard) {
      // Program-aware training Q&A
      if (hard.id === "training_program" && hard.program) {
        const p = hard.program;
        const q = classifyTrainingQ(prompt);
        let text = "";
        if (q === "who")       text = section(p.label, p.instructor || "TASK staff / partner instructors");
        else if (q === "where")text = section(p.label, p.location || "Trenton Area Soup Kitchen (Escher St.)");
        else if (q === "why")  text = section(p.label, p.purpose_outcomes || "Job training leading to industry credentials and referrals.");
        else if (q === "howlong") {
          text = section("Duration", p.duration) + section("Schedule", p.schedule);
        } else if (q === "when") {
          text = section("Next start", p.next_start_date || "TBD") + (p.app_window ? section("Application window", p.app_window) : "");
          text += section("Schedule", p.schedule);
        } else if (q === "cost") {
          text = section("Cost", p.cost || "Free");
        } else if (q === "eligibility") {
          text = section("Eligibility", p.eligibility || "See application.");
        } else {
          // general summary card
          text = [
            `**${p.label}**`,
            p.purpose_outcomes,
            section("Location", p.location),
            section("Schedule", p.schedule),
            section("Duration", p.duration),
            section("Eligibility", p.eligibility),
            section("Cost", p.cost),
            section("Next start", p.next_start_date || "TBD"),
            p.app_window ? section("Application window", p.app_window) : "",
            section("Apply", p.signup_link),
            section("Contact", p.contact_info),
            p.notes ? `\n${p.notes}\n` : ""
          ].filter(Boolean).join("\n");
        }
        // Employment-only numbers appear on employment intent; trainings don't add them by default.

        // Optional translate Tier-0 if user began in Spanish/Haitian
        if ((userLang === "es" || userLang === "ht") && GEMINI_API_KEY) {
          const tag = userLang === "es" ? "Spanish" : "Haitian Creole";
          const translated = await geminiGenerateText({
            apiKey: GEMINI_API_KEY,
            model: GEMINI_MODEL,
            text: `Translate the following into ${tag}. Preserve URLs and phone numbers:\n\n${text}`
          }).catch(()=> null);
          if (translated) text = translated;
        }
        return res.status(200).json({ text: linkifyPhonesAndUrls(text), source: `hardcoded:training:${p.key}` });
      }

      // Other intents (appointments/employment/resources/events/transit/crisis)
      if (hard.html) {
        let html = hard.html;
        if (hard.id === "employment") {
          html += `\nIf you need to verify a posting or have problems on the job, call **(609) 697-6215** or **(609) 697-6166**.`;
        }
        if ((userLang === "es" || userLang === "ht") && GEMINI_API_KEY) {
          const tag = userLang === "es" ? "Spanish" : "Haitian Creole";
          const translated = await geminiGenerateText({
            apiKey: GEMINI_API_KEY,
            model: GEMINI_MODEL,
            text: `Translate the following into ${tag}. Preserve URLs and phone numbers:\n\n${html}`
          }).catch(()=> null);
          if (translated) html = translated;
        }
        return res.status(200).json({ text: linkifyPhonesAndUrls(html), source: `hardcoded:${hard.id}` });
      }
    }

    // ---------- TIER 1: SUPABASE (simple name match; wh-logic can reuse same labels if present) ----------
    const supHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

    // trainings
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const tResp = await fetch(`${SUPABASE_URL}/rest/v1/trainings?select=*`, { headers: supHeaders });
      const trainings = tResp.ok ? await tResp.json() : [];
      const tMatch = trainings.find(t => {
        const tname = (t.name||"").toLowerCase();
        return answerBank.programsMeta.some(p => p.names.some(n => tname.includes(n) || (tname && (n.includes(tname) || tname.includes(n)))));
      }) || trainings.find(t => (prompt.toLowerCase()).includes((t.name||"").toLowerCase()));

      if (tMatch) {
        const q = classifyTrainingQ(prompt);
        let text = "";
        if (q === "who")       text = section(tMatch.name, tMatch.instructor || "TASK staff / partner instructors");
        else if (q === "where")text = section(tMatch.name, tMatch.location || "Trenton Area Soup Kitchen (Escher St.)");
        else if (q === "why")  text = section(tMatch.name, tMatch.purpose_outcomes || tMatch.description);
        else if (q === "howlong") {
          text = section("Duration", tMatch.duration) + section("Schedule", tMatch.schedule);
        } else if (q === "when") {
          text = section("Next start", tMatch.next_start_date || "TBD") + section("Schedule", tMatch.schedule);
        } else if (q === "cost") {
          text = section("Cost", tMatch.cost || "Free");
        } else if (q === "eligibility") {
          text = section("Eligibility", tMatch.eligibility || "");
        } else {
          text = [
            `**${tMatch.name}**`,
            tMatch.description || "",
            section("Location", tMatch.location),
            section("Schedule", tMatch.schedule),
            section("Duration", tMatch.duration),
            section("Eligibility", tMatch.eligibility),
            section("Cost", tMatch.cost || "Free"),
            section("Next start", tMatch.next_start_date || "TBD"),
            section("Apply", tMatch.signup_link),
            section("Contact", tMatch.contact_info)
          ].filter(Boolean).join("\n");
        }
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
        prompt.toLowerCase().includes(((j.name||j.title||"") + " " + (j.company||"")).toLowerCase().trim())
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
    }

    // ---------- TIER 2: GEMINI ----------
    const gText = await geminiGenerateText({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      text: `You are Solace, a warm and kind assistant for TASK.
Prefer TASK context about appointments, trainings (SORA, Culinary, Forklift), employment services, and resources.
If unsure, say you're unsure and suggest calling TASK.

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
