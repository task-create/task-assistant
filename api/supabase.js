// /api/supabase.js
// Lightweight Supabase REST helper for Vercel API routes (no SDK)

const MUST = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

const BASE_URL = () => MUST("SUPABASE_URL");
const ANON_KEY = () => MUST("SUPABASE_ANON_KEY");

/**
 * Build a querystring from a plain object.
 * Values that are undefined/null are skipped.
 */
function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  const s = new URLSearchParams(entries);
  return `?${s.toString()}`;
}

/**
 * Perform a Supabase REST request (select/insert/upsert/etc.).
 * @param {string} path e.g. "/rest/v1/trainings"
 * @param {object} init fetch init (method/body/headers)
 */
export async function sbFetch(path, init = {}) {
  const url = `${BASE_URL()}${path}`;
  const headers = {
    apikey: ANON_KEY(),
    Authorization: `Bearer ${ANON_KEY()}`,
    ...(init.headers || {}),
  };
  const resp = await fetch(url, { ...init, headers });

  // Supabase returns useful text on error; include it
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(`Supabase ${resp.status}: ${text || resp.statusText}`);
    err.status = resp.status;
    err.detail = text;
    throw err;
  }
  // Try JSON, fall back to text
  const ct = resp.headers.get("content-type") || "";
  return ct.includes("application/json") ? resp.json() : resp.text();
}

/**
 * Convenience: select rows from a table.
 * @param {string} table  e.g. "trainings"
 * @param {string} select e.g. "id,name,next_start_date"
 * @param {object} params query params (order, limit, filters built outside)
 */
export function selectTable(table, select = "*", params = {}) {
  const query = qs({ select, ...params });
  return sbFetch(`/rest/v1/${table}${query}`);
}

/**
 * Convenience: upsert into a table (expects array or single object).
 * NOTE: Requires RLS policy or service role key (don’t expose service key client-side).
 */
export function upsertTable(table, rows, onConflict) {
  const headers = { "Content-Type": "application/json", Prefer: "return=representation" };
  const q = qs(onConflict ? { on_conflict: onConflict } : {});
  return sbFetch(`/rest/v1/${table}${q}`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
}

/**
 * ILIKE helper for Supabase REST filter syntax (column=ilike.*foo*).
 * @param {string} column
 * @param {string} needle
 */
export function ilike(column, needle) {
  return { [column]: `ilike.%${needle}%` };
}

/**
 * ORDER helper: order=name.asc or date.desc
 * @param {string} column
 * @param {"asc"|"desc"} dir
 */
export function order(column, dir = "asc") {
  return { order: `${column}.${dir}` };
}
