// /api/ingest-jobs.js
// Bulk upsert jobs into Supabase via REST.
// Auth: require header `x-cron-secret: <CRON_SECRET>`
// Body: { jobs: [...] }  OR  [ ... ]  OR  { ...single job... }

import { upsertTable } from "./supabase";

const REQUIRED_SECRET = () => process.env.CRON_SECRET || "";   // set in Vercel

// Keep payloads sane
const CHUNK_SIZE = 200;

// Normalize one inbound job to your schema
function normalizeJob(j) {
  if (!j) return null;

  // Accept both "name" and "title" as the job title
  const title = j.title || j.name || "";
  const company = j.company || j.employer || "";
  const location = j.location || j.city_state || "";
  const description = j.description || j.summary || "";
  const apply_link = j.apply_link || j.url || j.applyUrl || "";
  const posted_at = j.posted_at || j.created_at || new Date().toISOString();
  const is_active = (j.is_active ?? true);

  // Pass through id if you have one (lets us upsert on primary key)
  const id = j.id;

  // If your table uses a different unique key (e.g., external_id),
  // include it in the payload and set JOBS_ON_CONFLICT env to that column.
  const external_id = j.external_id || j.slug || undefined;

  return {
    ...(id ? { id } : {}),
    ...(external_id ? { external_id } : {}),

    // The columns we know you have / commonly use
    name: title,         // if your table uses "title", Supabase will ignore "name"; adjust if needed
    title,               // keep both for safety; unused columns are ignored by Supabase
    company,
    location,
    description,
    apply_link,
    is_active,
    posted_at
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-cron-secret");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  // Simple auth
  const secret = req.headers["x-cron-secret"] || req.headers["X-Cron-Secret"];
  if (!REQUIRED_SECRET() || secret !== REQUIRED_SECRET()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const body = req.body || {};
    let inbound = [];

    if (Array.isArray(body)) {
      inbound = body;
    } else if (Array.isArray(body.jobs)) {
      inbound = body.jobs;
    } else if (typeof body === "object" && Object.keys(body).length) {
      inbound = [body];
    }

    if (!inbound.length) {
      return res.status(400).json({ error: "No jobs provided" });
    }

    // Normalize all jobs
    const rows = inbound
      .map(normalizeJob)
      .filter(Boolean);

    if (!rows.length) {
      return res.status(400).json({ error: "No valid jobs after normalization" });
    }

    // Decide upsert key
    // - If you include 'id' in rows, we'll upsert on id
    // - Else if you set env JOBS_ON_CONFLICT (e.g., "external_id" or "name,company,location"),
    //   we'll use that composite key. Create a UNIQUE index in Supabase to match it.
    const hasId = rows.some(r => typeof r.id !== "undefined");
    const onConflict =
      hasId ? "id" : (process.env.JOBS_ON_CONFLICT || undefined);

    // Upsert in chunks
    let saved = [];
    for (const part of chunk(rows, CHUNK_SIZE)) {
      const returned = await upsertTable("jobs", part, onConflict);
      // Supabase REST returns the representation when Prefer:return=representation
      if (Array.isArray(returned)) saved = saved.concat(returned);
    }

    // Build a small summary
    const ids = saved.map(r => r.id).filter(Boolean);
    res.status(200).json({
      ok: true,
      received: inbound.length,
      saved: saved.length,
      ids
    });
  } catch (err) {
    console.error("ingest-jobs error:", err);
    res.status(500).json({ error: err.message, detail: err.detail || null });
  }
}
