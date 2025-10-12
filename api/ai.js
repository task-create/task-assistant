// /api/ai.js
// TASK-first chatbot: query Supabase (trainings, jobs, resources) with ILIKE,
// format a helpful answer, fall back to Gemini only if nothing matches.

function okEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const SUPABASE_URL = okEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = okEnv("SUPABASE_ANON_KEY");
const GEMINI_API_KEY = okEnv("GEMINI_API_KEY");
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash").replace(/^models\//, "");

// ---- helpers ----
function linkify(text = "") {
  return text
    .replace(/(https?:\/\/[^\s)]+)\b/gi, (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`)
    .replace(/(\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b)/g, (m) => `<a href="tel:${m.replace(/[^\d]/g, "")}">${m}</a>`);
}

async function sb(path) {
  const resp = await fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => "");
    throw new Error(`Supabase ${resp.status}: ${msg || resp.statusText}`);
  }
  return resp.json();
}

// Build a Supabase REST "or=(col.ilike.*term*,col2.ilike.*term*)" safely
function orIlike(cols, term) {
  const t = encodeURIComponent(`*${term}*`);
  const inner = cols.map((c) => `${c}.ilike.${t}`).join(",");
  return `or=(${inner})`;
}

// Choose a reasonable keyword from the prompt (first word >=4 chars; else first token)
function pickKeyword(prompt = "") {
  const toks = (prompt || "").toLowerCase().split(/\W+/).filter(Boolean);
  return toks.find((w) => w.length >= 4) || toks[0] || "";
}

// Formatters
function fmtTraining(t) {
  const parts = [
    `📋 <b>${t.name}</b>`,
    t.description || "",
    t.schedule ? `🕘 <b>Schedule:</b> ${t.schedule}` : "",
    t.next_start_date ? `🗓 <b>Next class:</b> ${t.next_start_date}` : "🗓 <b>Next class:</b> TBD",
    t.duration ? `⏳ <b>Duration:</b> ${t.duration}` : "",
    t.requiremetns ? `✅ <b>Requirements:</b> ${t.requiremetns}` : "",
    t.start_date_note ? `📝 <b>Note:</b> ${t.start_date_note}` : "",
    t.contact_info ? `📞 <b>Contact:</b> ${t.contact_info}` : "",
    t.signup_link ? `🔗 <b>Sign up:</b> ${t.signup_link}` : "",
  ].filter(Boolean);
  return linkify(parts.join("\n"));
}

function fmtJob(j) {
  const title = j.title || j.name || "Job Opening";
  const parts = [
    `💼 <b>${title}</b>${j.company ? ` at ${j.company}` : ""}`,
    j.description || "",
    j.location ? `📍 ${j.location}` : "",
    j.apply_link ? `🔗 Apply: ${j.apply_link}` : "",
  ].filter(Boolean);
  return linkify(parts.join("\n"));
}

function fmtResource(r) {
  const parts = [
    `🧭 <b>${r.name}</b>${r.category ? ` (${r.category})` : ""}`,
    r.description || "",
    r.phone_number ? `📞 ${r.phone_number}` : "",
    r.website ? `🌐 ${r.website}` : "",
  ].filter(Boolean);
  return linkify(parts.join("\n"));
}

async function askGemini(prompt) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }]}] }),
    }
  );
  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry — I couldn’t find that.";
}

// ---- route ----
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const kw = pickKeyword(prompt);

    // Quick link: appointments
    if (/(appointment|book|schedule)\b/i.test(prompt)) {
      return res.status(200).json({
        text: linkify("📅 <b>Appointments:</b> https://bycell.co/ddncs"),
      });
    }

    // ---------- TRAININGS (culinary / SORA / forklift etc) ----------
    // Match against name + description + schedule
    if (/(training|class|culinary|sora|forklift|program)/i.test(prompt)) {
      const query =
        `/rest/v1/trainings?select=id,name,description,schedule,next_start_date,signup_link,duration,requiremetns,contact_info,start_date_note&${orIlike(
          ["name", "description", "schedule"],
          kw
        )}&order=next_start_date.asc&limit=1`;
      const t = await sb(query);
      if (Array.isArray(t) && t.length) {
        return res.status(200).json({ text: fmtTraining(t[0]) });
      }
    }

    // ---------- JOBS ----------
    if (/\b(job|jobs|hiring|opening|position|apply)\b/i.test(prompt)) {
      const query =
        `/rest/v1/jobs?select=id,name,title,company,location,description,apply_link,is_active,posted_at&${orIlike(
          ["title", "name", "description", "company", "location"],
          kw
        )}&order=posted_at.desc&limit=1`;
      const j = await sb(query);
      if (Array.isArray(j) && j.length) {
        return res.status(200).json({ text: fmtJob(j[0]) });
      }
    }

    // ---------- RESOURCES ----------
    if (/\b(resource|resources|help|housing|transport|legal|food|clinic|support)\b/i.test(prompt)) {
      const query =
        `/rest/v1/resources?select=id,name,category,description,website,phone_number&${orIlike(
          ["name", "description", "category"],
          kw
        )}&order=name.asc&limit=1`;
      const r = await sb(query);
      if (Array.isArray(r) && r.length) {
        return res.status(200).json({ text: fmtResource(r[0]) });
      }
    }

    // ---------- GENERIC LOCAL LOOKUP (try trainings -> jobs -> resources quickly) ----------
    const t2 = await sb(
      `/rest/v1/trainings?select=id,name,description,schedule,next_start_date,signup_link,duration,requiremetns,contact_info,start_date_note&${orIlike(
        ["name", "description"],
        kw
      )}&order=next_start_date.asc&limit=1`
    );
    if (Array.isArray(t2) && t2.length) return res.status(200).json({ text: fmtTraining(t2[0]) });

    const j2 = await sb(
      `/rest/v1/jobs?select=id,name,title,company,location,description,apply_link,is_active,posted_at&${orIlike(
        ["title", "name", "description"],
        kw
      )}&order=posted_at.desc&limit=1`
    );
    if (Array.isArray(j2) && j2.length) return res.status(200).json({ text: fmtJob(j2[0]) });

    const r2 = await sb(
      `/rest/v1/resources?select=id,name,category,description,website,phone_number&${orIlike(
        ["name", "description"],
        kw
      )}&order=name.asc&limit=1`
    );
    if (Array.isArray(r2) && r2.length) return res.status(200).json({ text: fmtResource(r2[0]) });

    // ---------- FALLBACK: GEMINI ----------
    const help =
      "Quick links:\n• Jobs: https://bycell.co/ddmtq\n• Trainings: https://bycell.co/ddmtn\n• Resources: https://bycell.co/ddmua\n• Appointments: https://bycell.co/ddncs";
    const ai = await askGemini(prompt);
    return res.status(200).json({ text: linkify(`${ai}\n\n${help}`) });

  } catch (err) {
    console.error("ai route error:", err);
    return res.status(500).json({ error: err.message });
  }
}

