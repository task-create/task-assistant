// GET /api/jobs?limit=20&q=warehouse&industry=Retail&location=Trenton&min_wage=17&approved=true
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY; // server-only!
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY" });
  }

  const limit    = Math.max(1, Math.min(100, parseInt(req.query.limit || "20", 10)));
  const q        = (req.query.q || "").toString().trim();
  const industry = (req.query.industry || "").toString().trim();
  const location = (req.query.location || "").toString().trim();
  const minWage  = req.query.min_wage ? Number(req.query.min_wage) : null;
  const approved = (req.query.approved ?? "true").toString(); // default true

  const p = new URLSearchParams();
  p.set("select", [
    "id","title","company","industry","location",
    "wage","apply_link","description",
    "created_at","created_at_external","approved","reviewed","flagged_reasons"
  ].join(","));
  p.set("order", "coalesce(created_at_external,created_at).desc");
  p.set("limit", String(limit));
  // keep results to your region if you added these columns
  p.set("state", "eq.NJ");
  p.set("county", "eq.Mercer");

  if (approved === "true") p.set("approved", "is.true");
  if (industry) p.set("industry", `eq.${industry}`);
  if (minWage)  p.set("wage", `gte.${minWage}`);
  if (location) p.set("location", `ilike.%${location}%`);
  if (q)        p.set("or", `(title.ilike.%${q}%,company.ilike.%${q}%,industry.ilike.%${q}%,location.ilike.%${q}%)`);

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/jobs?${p.toString()}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    if (!r.ok) throw new Error(await r.text());
    const rows = await r.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.status(200).json({ jobs: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
