// /api/ai.js
// TASK-first AI router: Supabase (trainings, jobs, resources, events) -> deterministic answer; else Gemini.
// No knowledge_base usage. No user PII stored.

import { createClient } from "@supabase/supabase-js";

/* ---------- ENV ---------- */
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY; // read-only
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = (process.env.GEMINI_MODEL || "gemini-2.5-flash").replace(/^models\//, "").trim();

/* ---------- Engage-by-Cell links ---------- */
const ENGAGE = {
  appointment: "https://bycell.co/ddncs",
  jobOpenings: "https://bycell.co/ddmtq",
  trainings:   "https://bycell.co/ddmtn",
  resources:   "https://bycell.co/ddmua",
};

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{ persistSession:false } })
  : null;

/* ---------- utils ---------- */
const todayISO = () => new Date().toISOString().slice(0,10);
const readJson = req => new Promise((resolve, reject) => {
  if (req.body && typeof req.body === "object") return resolve(req.body);
  let s = ""; req.on("data", c => s += c);
  req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch(e) { reject(e); }});
  req.on("error", reject);
});
const nonEmpty = v => typeof v === "string" && v.trim().length > 0;
const mdLine = (label, value) => nonEmpty(value) ? `**${label}:** ${value}\n` : "";

/* ---------- intent detection ---------- */
function detectIntent(prompt){
  const q = (prompt||"").toLowerCase();

  // Appointments
  if (/\b(appointment|schedule|book|make)\b/.test(q) && /\bappointment\b/.test(q)) {
    return { type: "appointment" };
  }

  // Events
  if (/\b(events?|workshops?|calendar|upcoming)\b/.test(q)) {
    return { type: "events" };
  }

  // Jobs
  if (/\b(jobs?|job|hiring|openings?|positions?|work)\b/.test(q)) {
    return { type: "jobs", query: q };
  }

  // Resources
  if (/\b(resource|resources|help|assistance|services?)\b/.test(q)) {
    return { type: "resources", query: q };
  }

  // Trainings (programs)
  const programHints = [];
  if (/(culinary|emilio|kitchen|chef)/i.test(q)) programHints.push("culinary");
  if (/\bsora\b/i.test(q)) programHints.push("sora");
  if (/(forklift|warehouse)/i.test(q)) programHints.push("forklift");

  if (programHints.length || /\b(training|program|class|course)\b/.test(q)) {
    const reqs   = /\b(requirements?|eligibility|qualifications?)\b/.test(q);
    const date   = /\b(next|when|start)\b/.test(q) && /\b(class|cohort|session|start)\b/.test(q);
    const signup = /\b(sign[\s-]?up|register|apply|application)\b/.test(q);
    let sub = "info";
    if (reqs) sub = "requirements";
    else if (date) sub = "date";
    else if (signup) sub = "signup";
    return { type:"training", hints: programHints, sub, fullQuery:q };
  }

  return { type: "open" }; // Gemini fallback
}

/* ---------- TRAININGS ---------- */
async function fetchTrainings({ text, hints, sub }){
  if (!supabase) return { data: [], error: null };

  const base = supabase
    .from("trainings")
    .select(`
      id,
      name,
      description,
      is_active,
      schedule,
      next_start_date,
      app_window_start,
      app_window_END,
      requiremetns,
      contact_info,
      signup_link,
      duration,
      start_date_note
    `)
    .eq("is_active", true)
    .order("next_start_date", { ascending:true })
    .limit(50);

  if (sub === "date" || sub === "signup") {
    base.gte("next_start_date", todayISO());
  }

  // ILIKE filters
  let orFilters = [];
  const addTerms = term => {
    const t = term.replace(/[%]/g,"");
    orFilters.push(`name.ilike.%${t}%`, `description.ilike.%${t}%`, `schedule.ilike.%${t}%`);
  };
  (hints||[]).forEach(addTerms);
  const q = (text||"").toLowerCase();
  if (!hints?.length && q.length >= 3) addTerms(q);
  if (orFilters.length) base.or(orFilters.join(","));

  const { data, error } = await base;
  return { data: data||[], error };
}
function formatTrainingCard(t, sub){
  const parts = [];
  parts.push(`📋 **${t.name || "Training"}**\n`);
  if (sub === "requirements") {
    const reqs = t.requiremetns || t.requirements;
    parts.push(nonEmpty(reqs) ? `${reqs.trim()}\n` : "_Requirements are TBD. Please contact us for details._\n");
  } else if (sub === "date") {
    parts.push(mdLine("Next class", t.next_start_date || "TBD"));
    if (nonEmpty(t.schedule)) parts.push(mdLine("Schedule", t.schedule));
  } else if (sub === "signup") {
    parts.push(mdLine("Next class", t.next_start_date || "TBD"));
    if (nonEmpty(t.signup_link)) parts.push(`**Sign-up:** ${t.signup_link}\n`);
  } else {
    if (nonEmpty(t.description)) parts.push(`${t.description.trim()}\n`);
  }
  if (sub !== "requirements") {
    if (nonEmpty(t.duration)) parts.push(mdLine("Duration", t.duration));
    if (nonEmpty(t.app_window_start)) parts.push(mdLine("Application window (start)", t.app_window_start));
    if (nonEmpty(t.app_window_END)) parts.push(mdLine("Application window (end)", t.app_window_END));
    if (nonEmpty(t.start_date_note)) parts.push(mdLine("Notes", t.start_date_note));
  }
  if (nonEmpty(t.contact_info)) parts.push(mdLine("Contact", t.contact_info));
  if (nonEmpty(t.signup_link) && sub!=="signup") parts.push(`**Sign-up:** ${t.signup_link}\n`);
  return parts.join("").trim();
}

/* ---------- JOBS ---------- */
// We use select('*') to tolerate schema differences; filter client-side for terms.
async function fetchJobs(queryText){
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .order("posted_at", { ascending:false })
    .limit(200);
  if (error) return { data: [], error };
  const q = (queryText||"").toLowerCase();
  if (!q) return { data, error:null };

  const terms = q.split(/\W+/).filter(w => w.length >= 3);
  const hay = row => {
    const fields = [
      row.title, row.name, row.company, row.category, row.location, row.description
    ].filter(Boolean).join(" ").toLowerCase();
    return terms.every(t => fields.includes(t));
  };
  return { data: data.filter(hay), error:null };
}
function formatJobsList(rows){
  if (!rows.length) {
    return `I don’t see matching job postings right now.\n\n**Browse Jobs:** ${ENGAGE.jobOpenings}`;
  }
  const items = rows.slice(0,5).map(j => {
    const title = j.title || j.name || "Job";
    const company = j.company ? ` — ${j.company}` : "";
    const loc = j.location ? ` — ${j.location}` : "";
    const link = j.apply_link || j.url || j.link;
    return `• **${title}**${company}${loc}${link ? ` — ${link}` : ""}`;
  }).join("\n");
  return `Here are current job postings:\n\n${items}\n\nSee more: ${ENGAGE.jobOpenings}`;
}

/* ---------- RESOURCES ---------- */
// select('*') to tolerate schema differences; filter client-side.
async function fetchResources(queryText){
  if (!supabase) return { data: [], error:null };
  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("is_active", true)
    .limit(300);
  if (error) return { data: [], error };
  const q = (queryText||"").toLowerCase();
  if (!q) return { data, error:null };

  const terms = q.split(/\W+/).filter(w => w.length >= 3);
  const hay = row => {
    const fields = [
      row.name, row.title, row.category, row.tags, row.description, row.location, row.city
    ].filter(Boolean).join(" ").toLowerCase();
    return terms.every(t => fields.includes(t));
  };
  return { data: data.filter(hay), error:null };
}
function formatResourcesList(rows){
  if (!rows.length) {
    return `I don’t see a matching resource right now.\n\n**Browse Community Resources:** ${ENGAGE.resources}`;
  }
  const items = rows.slice(0,8).map(r => {
    const name = r.name || r.title || "Resource";
    const cat  = r.category ? ` — ${r.category}` : "";
    const site = r.website || r.url || r.link;
    const phone = r.phone || r.telephone || r.contact_phone;
    const contact = site ? ` — ${site}` : (phone ? ` — ${phone}` : "");
    return `• **${name}**${cat}${contact}`;
  }).join("\n");
  return `Relevant resources:\n\n${items}\n\nMore here: ${ENGAGE.resources}`;
}

/* ---------- EVENTS (optional table) ---------- */
async function fetchEvents(){
  if (!supabase) return { data: [], error:null };
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("is_active", true)
    .gte("start_date", todayISO())
    .order("start_date", { ascending:true })
    .limit(50);
  return { data: data||[], error };
}
function formatEventsList(rows){
  if (!rows.length) {
    return `There are no upcoming events posted yet.\n\n**Trainings:** ${ENGAGE.trainings}`;
  }
  const items = rows.map(ev => {
    const link = ev.signup_link || ev.url || ev.link;
    return `• **${ev.title || "Event"}** — ${ev.start_date || "TBD"}${link ? ` — ${link}` : ""}`;
  }).join("\n");
  return `Upcoming TASK events:\n\n${items}`;
}

/* ---------- Gemini fallback ---------- */
async function askGemini(promptText){
  if (!GEMINI_API_KEY) return "(No TASK match found; Gemini is not configured.)";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const preamble =
    "You are a helpful assistant for TASK (Trenton Area Soup Kitchen). " +
    "If you do not have TASK-specific details, answer generally and clearly say data may vary.";
  const body = { contents: [{ role:"user", parts:[{ text: `${preamble}\n\nUser: ${promptText}` }]}] };
  const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  const raw = await r.text().catch(()=> "");
  if (!r.ok) throw new Error(`Gemini upstream ${r.status}: ${raw}`);
  const data = raw ? JSON.parse(raw) : {};
  const parts = data?.candidates?.[0]?.content?.parts || [];
  let text = ""; for (const p of parts) if (typeof p?.text === "string") text += p.text;
  return text || "(no response)";
}

/* ---------- HTTP handler ---------- */
export default async function handler(req, res){
  // CORS
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","content-type");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

  try{
    const { prompt } = await readJson(req);
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: "Missing prompt" });

    const intent = detectIntent(prompt);

    // Appointments
    if (intent.type === "appointment") {
      return res.status(200).json({ text: `You can schedule an appointment here:\n\n**Make an appointment:** ${ENGAGE.appointment}` });
    }

    // Trainings (info/date/requirements/signup)
    if (intent.type === "training") {
      const { data, error } = await fetchTrainings({ text: intent.fullQuery, hints:intent.hints, sub:intent.sub });
      if (error) return res.status(500).json({ error: `Supabase error: ${error.message}` });

      if (data.length === 1) {
        return res.status(200).json({ text: formatTrainingCard(data[0], intent.sub) });
      }
      if (data.length > 1) {
        const items = data.slice(0,6).map(t => `• **${t.name}** — ${t.next_start_date || "TBD"}${t.signup_link ? ` — ${t.signup_link}` : ""}`).join("\n");
        return res.status(200).json({ text: `I found multiple trainings. Which one do you mean?\n\n${items}` });
      }
      // fall through to Gemini if nothing matched
      const ai = await askGemini(prompt);
      return res.status(200).json({ text: ai });
    }

    // Jobs
    if (intent.type === "jobs") {
      const { data, error } = await fetchJobs(intent.query);
      if (error) return res.status(500).json({ error: `Supabase error: ${error.message}` });
      return res.status(200).json({ text: formatJobsList(data) });
    }

    // Resources
    if (intent.type === "resources") {
      const { data, error } = await fetchResources(intent.query);
      if (error) return res.status(500).json({ error: `Supabase error: ${error.message}` });
      return res.status(200).json({ text: formatResourcesList(data) });
    }

    // Events (optional)
    if (intent.type === "events") {
      const { data, error } = await fetchEvents();
      if (error) return res.status(500).json({ error: `Supabase error: ${error.message}` });
      return res.status(200).json({ text: formatEventsList(data) });
    }

    // Gemini fallback
    const ai = await askGemini(prompt);
    return res.status(200).json({ text: ai });

  }catch(err){
    return res.status(502).json({ error: err?.message || String(err) });
  }
}
