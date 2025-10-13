// /api/ai.js
// Priority: (1) rule-based TASK answers  (2) Supabase fuzzy  (3) Gemini
// Context-aware: if prompt is generic (“information”, “when?”…), use context.lastTopic

import fetch from "node-fetch";

const ok = (res, data) => res.status(200).json(data);
const bad = (res, code, msg) => res.status(code).json({ error: msg });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return bad(res, 405, "Method Not Allowed");

  try {
    const { prompt, context } = req.body || {};
    if (!prompt || !String(prompt).trim()) return bad(res, 400, "Missing prompt");

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash").replace(/^models\//, "");

    let q = String(prompt).trim();
    let topic = detectTopic(q) || context?.lastTopic || null;

    // If the user is answering with a generic follow-up like "information", keep the topic
    if (isGenericFollowUp(q) && topic) {
      // Expand q a bit so fuzzy search still works (e.g., “information” → “information about sora”)
      q = `details about ${topic} ${q}`;
    }

    // 1) Rule-based TASK answers FIRST (sticky by topic)
    const ruleHit = ruleAnswer(q, topic);
    if (ruleHit) return ok(res, { text: ruleHit.text, source: `rule:${ruleHit.id}`, topic: ruleHit.topic || topic });

    // 2) Supabase fuzzy search
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supa = await trySupabaseFirst(SUPABASE_URL, SUPABASE_ANON_KEY, q);
      if (supa) return ok(res, { text: supa, source: "supabase", topic });
    }

    // 3) Gemini fallback
    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: q }] }] }),
      }
    );
    if (!gRes.ok) {
      const detail = await gRes.text().catch(() => "");
      throw new Error(
        `Upstream 400 from Gemini (model name). Check server env:\n` +
        `GEMINI_MODEL must be "gemini-2.5-flash" (no "models/").\n${detail}`
      );
    }
    const g = await gRes.json();
    const text = g?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry — I couldn’t find that.";
    return ok(res, { text, source: "gemini", topic });

  } catch (err) {
    console.error(err);
    return bad(res, 500, err.message || "Server error");
  }
}

/* -------------------------- helpers -------------------------- */

function stripIndent(s) {
  const a = s.replace(/^\n+/, "");
  const m = a.match(/^[ \t]+/);
  if (!m) return a.trim();
  const pad = m[0];
  return a.replace(new RegExp("^" + pad, "gm"), "").trim();
}

// Detect the subject the user is talking about
function detectTopic(text) {
  const t = text.toLowerCase();
  if (/\bsora\b|\bsecurity\s*(officer|guard)\b/.test(t)) return "sora";
  if (/\bemilio\b|\bculinary\b/.test(t)) return "emilio";
  if (/\bforklift\b/.test(t)) return "forklift";
  if (/\bappointment\b|\bschedule\b|\bmake\s+an?\s+appointment\b/.test(t)) return "appointment";
  if (/\bnj\s*transit\b|\btrip\s*planner\b/.test(t)) return "njt";
  if (/\bresource(s)?\b/.test(t)) return "resources";
  if (/\bjobs?\b/.test(t)) return "jobs";
  return null;
}

// If the message is vague, we keep the last topic
function isGenericFollowUp(text) {
  const t = text.trim().toLowerCase();
  return /^(info|information|details?|requirements?|who|what|when|where|how|how long|how much|\?)\??$/.test(t);
}

function ruleAnswer(q, topic) {
  // Prefer a topic (sticky), else detect from the current utterance
  const t = topic || detectTopic(q);
  if (!t) return null;

  const reply = {
    sora: stripIndent(`
SORA Security Officer Training — quick facts

• What: Free, **2-day** NJ **Unarmed SORA certification** course (9:00 AM–5:00 PM), held virtually with support at the **TASK Computer Lab**.  
• Why: Meet NJ state training rules so you can apply for **entry-level security jobs**. TASK covers **all class + certification costs**.  
• Support: We help with **registration, fingerprinting, and job referrals** after you pass.  
• Requirements:
  - **18+** years old  
  - **No convictions or active warrants** (felony or misdemeanor)  
  - **Attend the mandatory SORA info session**  
  - **Complete the application**  
• Next class: **TBD** (space is limited).  
• Important: If selected for **SORA**, you **cannot** be in the **Emilio Culinary Academy** at the same time.  
• How to apply: **Appointment required** — call the **Social Services Specialist** at **(609) 337-1624** (no walk-ins) or use the interest link: https://bycell.co/ddmtn  
• Questions? Call **(609) 697-6215** or **(609) 697-6166**.

Need anything else about SORA (dates, eligibility, what to bring)?
    `),

    emilio: stripIndent(`
Emilio’s Culinary Academy — quick facts

• What: **Free 10-week** program (8 weeks hands-on training + 2-week internship), includes **ServSafe® Food Manager**.  
• Focus: Kitchen skills, life skills, digital literacy, and **job readiness**; grads hired by partners like **Sodexo**, **Princeton Dining**, **Capital Health**.  
• Eligibility:
  - **18+**  
  - Cannot have convictions for **sexual offenses** or **arson**  
• Program fit: Looking for people **genuinely interested** in culinary careers.  
• Cohorts: **Next class** scheduled **Oct 8, 2025**; application window **Sep 25 – Oct 1**.  
• Apply: https://forms.office.com/r/Me7avaaXWx  
• Note: If selected for **Emilio**, you cannot be in **SORA** simultaneously.
    `),

    forklift: stripIndent(`
Forklift Certification Class — quick facts

• What: **1-day** class focused on the **written test** (most employers train on-site for hands-on).  
• When/Where: **2:00–4:00 PM**, **TASK Conference Room**.  
• Next class: **Oct 14 @ 2:00 PM**.  
• Hands-on needed? Our certified instructor can coordinate **on-site** at your employer if required.  
• Sign up: https://forms.office.com/r/pXe4G2y0JH  
• Need help? Call **(609) 697-6215** or **(609) 697-6166**.
    `),

    appointment: stripIndent(`
Appointments at TASK

• We **do not accept walk-ins** for Employment & Education services.  
• To schedule, **call the Social Services Specialist** at **(609) 337-1624**  
  – we’ll ask a few short questions and create an **Individual Employment Plan (IEP)**.  
• After your IEP, we’ll book your follow-up with an **Employment Assistant**.  
• **Bus tickets**: provided only after an IEP for **first two weeks of a new job** or for **orientations/interviews**.  
• Quick link: https://bycell.co/ddncs
    `),
  };

  if (reply[t]) return { id: t, text: reply[t], topic: t };
  return null;
}

async function trySupabaseFirst(url, anon, q) {
  const headers = { apikey: anon, Authorization: `Bearer ${anon}` };
  const enc = encodeURIComponent(`*${q}*`);

  // trainings first
  {
    const u = `${url}/rest/v1/trainings?select=name,description,next_start_date,signup_link,contact_info,schedule&or=(name.ilike.${enc},description.ilike.${enc})&order=next_start_date.nullslast.asc&limit=3`;
    const r = await fetch(u, { headers });
    if (r.ok) {
      const rows = await r.json();
      const best = rows?.[0];
      if (best) return formatTraining(best);
    }
  }

  // resources
  {
    const u = `${url}/rest/v1/resources?select=name,description,website,phone_number&or=(name.ilike.${enc},description.ilike.${enc})&limit=3`;
    const r = await fetch(u, { headers });
    if (r.ok) {
      const rows = await r.json();
      const best = rows?.[0];
      if (best) return formatResource(best);
    }
  }

  // jobs
  {
    const u = `${url}/rest/v1/jobs?select=title,company,location,description,apply_link&or=(title.ilike.${enc},company.ilike.${enc},description.ilike.${enc})&limit=3`;
    const r = await fetch(u, { headers });
    if (r.ok) {
      const rows = await r.json();
      const best = rows?.[0];
      if (best) return formatJob(best);
    }
  }

  return null;
}

function formatTraining(t) {
  const parts = [];
  parts.push(`**${t.name}**`);
  if (t.description) parts.push(t.description);
  if (t.next_start_date) parts.push(`Next start: ${t.next_start_date}`);
  if (t.schedule) parts.push(`Schedule: ${t.schedule}`);
  if (t.signup_link) parts.push(`Sign up: ${t.signup_link}`);
  if (t.contact_info) parts.push(`Contact: ${t.contact_info}`);
  return parts.join("\n\n");
}

function formatResource(r) {
  const parts = [];
  parts.push(`**${r.name}**`);
  if (r.description) parts.push(r.description);
  if (r.phone_number) parts.push(`Phone: ${r.phone_number}`);
  if (r.website) parts.push(`Website: ${r.website}`);
  return parts.join("\n\n");
}

function formatJob(j) {
  const parts = [];
  parts.push(`**${j.title || "Job"}**${j.company ? ` — ${j.company}` : ""}`);
  if (j.location) parts.push(`Location: ${j.location}`);
  if (j.description) parts.push(j.description);
  if (j.apply_link) parts.push(`Apply: ${j.apply_link}`);
  return parts.join("\n\n");
}
