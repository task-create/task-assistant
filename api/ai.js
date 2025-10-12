// /api/ai.js
// TASK-first router: Supabase (trainings/events) → deterministic answer; else Gemini fallback.

import { createClient } from "@supabase/supabase-js";

/* ---------- ENV ---------- */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY; // read-only
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash").replace(/^models\//, "").trim();

/* ---------- CONSTANTS (Engage by Cell primary links) ---------- */
const ENGAGE = {
  appointment: "https://bycell.co/ddncs",
  jobOpenings: "https://bycell.co/ddmtq",
  trainings:   "https://bycell.co/ddmtn",
  resources:   "https://bycell.co/ddmua",
};

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession:false }})
  : null;

/* ---------- small utils ---------- */
function todayISO() { return new Date().toISOString().slice(0,10); }
function readJson(req){
  return new Promise((resolve,reject)=>{
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let s=''; req.on('data',c=>s+=c); req.on('end',()=>{ try{ resolve(s?JSON.parse(s):{});}catch(e){reject(e);} }); req.on('error',reject);
  });
}
const clean = v => (typeof v==='string' ? v.trim() : v);
const nonEmpty = v => typeof v === 'string' && v.trim().length>0;
const mdLine = (label, value) => nonEmpty(value) ? `**${label}:** ${value}\n` : "";

/* ---------- intent detection ---------- */
function detectIntent(prompt){
  const q = (prompt||"").toLowerCase();

  // global intents
  if (/\b(appointment|schedule|book|make)\b/.test(q) && /\bappointment\b/.test(q)) {
    return { type:'appointment' };
  }

  // events
  if (/\b(events?|workshops?|calendar|upcoming)\b/.test(q)) {
    return { type:'events' };
  }

  // program keywords
  const programHints = [];
  if (/(culinary|emilio|kitchen|chef)/i.test(q)) programHints.push('culinary');
  if (/\bsora\b/i.test(q)) programHints.push('sora');
  if (/(forklift|warehouse)/i.test(q)) programHints.push('forklift');

  if (programHints.length) {
    const info = /\b(tell me about|what is|overview|info|information|details|explain)\b/.test(q);
    const reqs = /\b(requirements?|eligibility|qualifications?)\b/.test(q);
    const date = /\b(next|start|when)\b/.test(q) && /\b(class|cohort|session|start)\b/.test(q);
    const signup = /\b(sign[\s-]?up|register|apply|application)\b/.test(q);

    let sub = 'info';
    if (reqs) sub = 'requirements';
    else if (date) sub = 'date';
    else if (signup) sub = 'signup';
    else if (info) sub = 'info';

    return { type:'training', hints: programHints, sub };
  }

  // generic training ask
  if (/\b(training|program|class)\b/.test(q)) return { type:'training', hints: [], sub:'info' };

  // default -> gemini
  return { type:'open' };
}

/* ---------- Supabase: trainings ---------- */
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
    .order("next_start_date", { ascending:true, nullsFirst:false })
    .limit(50);

  // If question is about "next class", prefer upcoming
  if (sub === 'date' || sub === 'signup') {
    base.gte("next_start_date", todayISO());
  }
  // Always prefer active if we can
  base.eq("is_active", true);

  // ILIKE filter by hints or broad query text
  let orFilters = [];
  const addTerms = (term) => {
    const t = term.replace(/[%]/g,''); // basic safety
    orFilters.push(`name.ilike.%${t}%`);
    orFilters.push(`description.ilike.%${t}%`);
    orFilters.push(`schedule.ilike.%${t}%`);
  };

  (hints || []).forEach(addTerms);
  const q = (text || "").toLowerCase();
  if (!hints?.length && q.length >= 3) addTerms(q);

  if (orFilters.length) {
    base.or(orFilters.join(","));
  }

  const { data, error } = await base;
  return { data: data || [], error };
}

function formatTrainingCard(t, sub){
  const parts = [];

  // Title
  parts.push(`📋 **${t.name || "Training"}**\n`);

  // Body by sub-intent
  if (sub === 'requirements') {
    const reqs = t.requiremetns || t.requirements; // handle typo column
    parts.push(nonEmpty(reqs) ? `${reqs.trim()}\n` : "_Requirements are TBD. Please contact us for details._\n");
  } else if (sub === 'date') {
    parts.push(mdLine("Next class", t.next_start_date || "TBD"));
    if (nonEmpty(t.schedule)) parts.push(mdLine("Schedule", t.schedule));
  } else if (sub === 'signup') {
    parts.push(mdLine("Next class", t.next_start_date || "TBD"));
    if (nonEmpty(t.signup_link)) parts.push(`**Sign-up:** ${t.signup_link}\n`);
  } else { // info
    if (nonEmpty(t.description)) parts.push(`${t.description.trim()}\n`);
  }

  // Always include helpful fields
  if (sub !== 'requirements') {
    if (nonEmpty(t.duration)) parts.push(mdLine("Duration", t.duration));
    if (nonEmpty(t.app_window_start)) parts.push(mdLine("Application window (start)", t.app_window_start));
    if (nonEmpty(t.app_window_END)) parts.push(mdLine("Application window (end)", t.app_window_END));
    if (nonEmpty(t.start_date_note)) parts.push(mdLine("Notes", t.start_date_note));
  }
  if (nonEmpty(t.contact_info)) parts.push(mdLine("Contact", t.contact_info));
  if (nonEmpty(t.signup_link) && sub!=='signup') parts.push(`**Sign-up:** ${t.signup_link}\n`);

  return parts.join("").trim();
}

/* ---------- Supabase: events (optional table) ---------- */
async function fetchUpcomingEvents(){
  if (!supabase) return { data: [], error: null };
  // adjust column names to your actual events schema if different
  const { data, error } = await supabase
    .from("events")
    .select("id,title,description,start_date,signup_link,is_active")
    .eq("is_active", true)
    .gte("start_date", todayISO())
    .order("start_date", { ascending:true })
    .limit(20);
  return { data: data || [], error };
}

/* ---------- Gemini fallback ---------- */
async function askGemini(promptText){
  if (!GEMINI_API_KEY) {
    return "(No TASK match found; Gemini is not configured.)";
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const preamble = "You are a helpful assistant for TASK (Trenton Area Soup Kitchen). If you were not given TASK program details, answer generally and clearly say when information is not TASK-specific. Be concise and action-oriented.";
  const body = {
    contents: [
      { role:"user", parts:[{ text: `${preamble}\n\nUser: ${promptText}` }]}
    ]
  };
  const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  const raw = await r.text().catch(()=> "");
  if (!r.ok) throw new Error(`Gemini upstream ${r.status}: ${raw}`);
  const data = raw ? JSON.parse(raw) : {};
  const parts = data?.candidates?.[0]?.content?.parts || [];
  let text = ""; for (const p of parts) if (typeof p?.text === "string") text += p.text;
  return text || "(no response)";
}

/* ---------- HTTP Handler ---------- */
export default async function handler(req, res){
  // CORS
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","content-type");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

  try{
    const { prompt } = await readJson(req);
    if (!prompt || !prompt.trim()) return res.status(400).json({ error:"Missing prompt" });

    const intent = detectIntent(prompt);

    // 1) Appointment direct link
    if (intent.type === 'appointment') {
      return res.status(200).json({
        text: `You can schedule an appointment here:\n\n**Make an appointment:** ${ENGAGE.appointment}`
      });
    }

    // 2) Training queries (TASK-first)
    if (intent.type === 'training') {
      const { data, error } = await fetchTrainings({ text: prompt, hints: intent.hints, sub: intent.sub });
      if (error) return res.status(500).json({ error: `Supabase error: ${error.message}` });

      if (data.length === 1) {
        return res.status(200).json({ text: formatTrainingCard(data[0], intent.sub) });
      }
      if (data.length > 1) {
        // show short list to disambiguate
        const items = data.slice(0,5).map(t => `• **${t.name}** — ${t.next_start_date || 'TBD'}${t.signup_link ? ` — ${t.signup_link}` : ''}`).join("\n");
        const msg = `I found a few relevant TASK trainings. Which one do you mean?\n\n${items}\n\n(Reply with the program name.)`;
        return res.status(200).json({ text: msg });
      }
      // nothing matched → Gemini fallback
      const ai = await askGemini(prompt);
      return res.status(200).json({ text: ai });
    }

    // 3) Events (if your 'events' table exists)
    if (intent.type === 'events') {
      const { data, error } = await fetchUpcomingEvents();
      if (error) return res.status(500).json({ error: `Supabase error: ${error.message}` });
      if (data.length === 0) {
        return res.status(200).json({ text: "There are no upcoming events posted yet. You can also check trainings here:\n\n" + `**Trainings:** ${ENGAGE.trainings}` });
      }
      const lines = data.map(ev => `• **${ev.title}** — ${ev.start_date || 'TBD'}${ev.signup_link ? ` — ${ev.signup_link}` : ''}`);
      return res.status(200).json({ text: `Upcoming TASK events:\n\n${lines.join("\n")}` });
    }

    // 4) Everything else → Gemini (with guardrail)
    const ai = await askGemini(prompt);
    return res.status(200).json({ text: ai });

  }catch(err){
    return res.status(502).json({ error: err?.message || String(err) });
  }
}
