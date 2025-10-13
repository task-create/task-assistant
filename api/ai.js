// /api/ai.js
// Order: Tier-0 (programsMap Q&A + hardcoded intents) -> Tier-1 (Supabase) -> Tier-2 (Gemini)

import fetch from "node-fetch";
import { matchHardcoded } from "../data/hardcoded.js";

/* ------------------------- Config Helpers ------------------------- */
const env = (k, d=null) => process.env[k] ?? d;

/* ------------------------- Gemini Helpers ------------------------- */
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
  const t = (s||"").toLowerCase();
  const looksES = /\b(hola|gracias|por favor|necesito|trabajo|entrevista|curriculum|curso)\b/.test(t);
  const looksHT = /\b(bonj(ou|o)r|mwen|ou|kijan|mèsi|travay|entèvyou|rezime)\b/.test(t);
  if (looksES) return "es";
  if (looksHT) return "ht";
  return "en";
}

/* ------------------------- Programs Map (Tier-0) ------------------------- */
/* Hard-coded authoritative data for precise Q&A. */
const programsMap = [
  {
    id: "sora",
    name: "Unarmed SORA Security Training",
    keywords: [
      "sora","security","unarmed","guard","guard card","security officer",
      "security training","security license"
    ],
    location: "Virtual (TASK Computer Lab), 72 ½ Escher St., Trenton, NJ 08609",
    schedule: "9:00 AM – 5:00 PM (two consecutive days)",
    duration: "2 days",
    purpose_outcomes:
      "Prepares you for NJ Unarmed Security Officer license; qualifies you for entry-level security jobs statewide. TASK assists with registration, fingerprinting, and job referrals.",
    eligibility:
      "18+, complete application + mandatory info session, no criminal/misdemeanor convictions, no active warrants.",
    cost: "Free (covered by TASK).",
    next_start_date: "TBD",
    signup_link: "https://forms.office.com/r/4j7x4kY7wu",
    contact_info: "(609) 337-1624",
    instructor: "TASK staff / SORA 100 instructors",
    exclusivity_note: "If selected for SORA, you cannot enroll in Emilio’s Culinary Academy at the same time."
  },
  {
    id: "culinary",
    name: "Emilio’s Culinary Academy",
    keywords: [
      "emilio culinary","culinary academy","culinary","cooking","servsafe",
      "emilio’s culinary academy","emilios culinary"
    ],
    location: "Trenton Area Soup Kitchen, 72 ½ Escher St., Trenton, NJ 08609",
    schedule: "Cohort-based; class schedule during 8 weeks + 2-week internship.",
    duration: "10 weeks (8 weeks class + 2-week internship)",
    purpose_outcomes:
      "Hands-on kitchen skills, life skills, digital literacy, job readiness; ends with ServSafe® Food Manager certification and job placement support.",
    eligibility:
      "18+, no convictions for sexual offenses or arson. Must commit to the training; cannot take SORA simultaneously.",
    cost: "Free (covered by TASK).",
    next_start_date: "2025-10-08",
    signup_link: "https://forms.office.com/r/Me7avaaXWx",
    contact_info: "(609) 695-5456 / (609) 337-1624",
    instructor: "Chef Adam Livow & TASK Culinary Staff",
    application_window: "Sept 25 – Oct 1",
    exclusivity_note: "If selected for Culinary, you cannot enroll in SORA at the same time."
  },
  {
    id: "forklift",
    name: "Forklift Certification Class",
    keywords: ["forklift","warehouse","logistics","fork lift","fork-lift","fork truck"],
    location: "TASK Conference Room, 72 ½ Escher St., Trenton, NJ 08609",
    schedule: "2:00–4:00 PM (single session)",
    duration: "1 day (2 hours)",
    purpose_outcomes:
      "Prepares you for the written portion of the forklift operator test; most employers provide hands-on training on the job. On-site instruction can be arranged with your employer if needed.",
    eligibility: "18+",
    cost: "Free (covered by TASK).",
    next_start_date: "2025-10-14 14:00",
    signup_link: "https://forms.office.com/r/pXe4G2y0JH",
    contact_info: "(609) 697-6215 / (609) 697-6166",
    instructor: "TASK Certified Forklift Instructor"
  }
];

/* Fuzzy match: pick program whose keywords appear in prompt. */
function findProgram(prompt="") {
  const t = (prompt||"").toLowerCase();
  let best = null, bestScore = 0;
  for (const p of programsMap) {
    let score = 0;
    for (const k of p.keywords) if (t.includes(k.toLowerCase())) score++;
    // also try loose name match
    if (t.includes((p.name||"").toLowerCase())) score += 2;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  // Also catch generic terms mapping:
  if (!best) {
    if (/\bsora\b|\bsecurity\b/i.test(prompt)) best = programsMap.find(x=>x.id==="sora");
    else if (/\bculinary|emilio/i.test(prompt)) best = programsMap.find(x=>x.id==="culinary");
    else if (/\bfork ?lift\b/i.test(prompt)) best = programsMap.find(x=>x.id==="forklift");
  }
  return bestScore > 0 ? best : best; // return even if generic branch picked
}

/* Detect question focus */
function qType(p){
  p = (p||"").toLowerCase();
  if (/\bwho\b|instructor|teacher|led by/i.test(p)) return "who";
  if (/\bwhere\b|location|address|room|lab/i.test(p)) return "where";
  if (/\bwhy\b|benefit|outcome|what (do|will) i (learn|get)|cert/i.test(p)) return "why";
  if (/\bhow long\b|duration|weeks|hours|length/i.test(p)) return "howlong";
  if (/\bwhen\b|next (start|class|cohort|session|date)/i.test(p)) return "when";
  if (/\bhow much\b|cost|price|tuition|fee/i.test(p)) return "cost";
  if (/\brequirements?|eligibility|qualifications?/i.test(p)) return "eligibility";
  return "general";
}

/* Format answer for a specific field */
function formatProgramAnswer(p, type){
  const parts = [];
  const add = (label, v) => { if(v) parts.push(`**${label}:** ${v}`); };

  switch(type){
    case "who":        add(p.name, p.instructor || "TASK staff / partner instructors"); break;
    case "where":      add(p.name, p.location || "Trenton Area Soup Kitchen (Escher St.)"); break;
    case "why":        add(p.name, p.purpose_outcomes || "Job-ready skills and certification"); break;
    case "howlong":    { add("Duration", p.duration); add("Schedule", p.schedule); } break;
    case "when":       { add("Next start", p.next_start_date || "TBD"); add("Schedule", p.schedule); } break;
    case "cost":       add("Cost", p.cost || "Free (covered by TASK)"); break;
    case "eligibility":add("Eligibility", p.eligibility || "See application for details"); break;
    default: {
      // General summary
      add(p.name, p.purpose_outcomes);
      add("Location", p.location);
      add("Duration", p.duration);
      add("Schedule", p.schedule);
      add("Next start", p.next_start_date || "TBD");
      add("Eligibility", p.eligibility);
      add("Cost", p.cost);
      if (p.exclusivity_note) parts.push(p.exclusivity_note);
    }
  }

  const footer = [
    p.signup_link ? `Sign up: ${p.signup_link}` : "",
    p.contact_info ? `Contact: ${p.contact_info}` : ""
  ].filter(Boolean).join("\n");

  return (parts.join("\n") + (footer ? `\n\n${footer}` : ""));
}

/* ------------------------- Handler ------------------------- */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error:"Missing prompt" });

    const SUPABASE_URL   = env("SUPABASE_URL");
    const SUPABASE_KEY   = env("SUPABASE_ANON_KEY");
    const GEMINI_API_KEY = env("GEMINI_API_KEY");
    const GEMINI_MODEL   = env("GEMINI_MODEL", "gemini-2.5-flash");

    const userLang = detectLang(prompt); // 'en' | 'es' | 'ht'

    /* ---------- Tier-0a: Programs map with wh-answers ---------- */
    const prog = findProgram(prompt);
    if (prog) {
      const type = qType(prompt);
      let text = formatProgramAnswer(prog, type);
      // Translate Tier-0 only if user began in ES/HT
      if ((userLang === "es" || userLang === "ht") && GEMINI_API_KEY) {
        const tag = userLang === "es" ? "Spanish" : "Haitian Creole";
        const tt = await geminiGenerateText({
          apiKey: GEMINI_API_KEY, model: GEMINI_MODEL,
          text: `Translate into ${tag}. Keep URLs and phone numbers exactly as-is:\n\n${text}`
        }).catch(()=> null);
        if (tt) text = tt;
      }
      return res.status(200).json({ text, source:`hardcoded:program:${prog.id}:${type}` });
    }

    /* ---------- Tier-0b: Generic hardcoded intents (appointments, jobs help, resources, transit, crisis, etc.) ---------- */
    const hard = matchHardcoded(prompt, {});
    if (hard?.html) {
      let html = hard.html;
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

    /* ---------- Tier-1: Supabase (only if configured) ---------- */
    if (SUPABASE_URL && SUPABASE_KEY) {
      const supHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

      // trainings
      const tResp = await fetch(`${SUPABASE_URL}/rest/v1/trainings?select=*`, { headers: supHeaders });
      if (tResp.ok) {
        const trainings = await tResp.json();
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
      }

      // jobs
      const jResp = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=*`, { headers: supHeaders });
      if (jResp.ok) {
        const jobs = await jResp.json();
        const jMatch = jobs.find(j => prompt.toLowerCase().includes((j.name||j.title||"").toLowerCase()));
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
      }

      // resources
      const rResp = await fetch(`${SUPABASE_URL}/rest/v1/resources?select=*`, { headers: supHeaders });
      if (rResp.ok) {
        const resources = await rResp.json();
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
    }

    /* ---------- Tier-2: Gemini fallback ---------- */
    const gText = await geminiGenerateText({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      text: `You are Solace, a warm and kind assistant for TASK (Trenton Area Soup Kitchen).
Answer concisely. For TASK topics (appointments, trainings, resources, jobs), prefer TASK context.
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
