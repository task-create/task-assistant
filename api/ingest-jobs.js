// /api/ingest-jobs?secret=YOUR_CRON_SECRET
export default async function handler(req, res) {
  if (req.query.secret !== process.env.CRON_SECRET)
    return res.status(401).json({ error: "Unauthorized" });

  const {
    ADZUNA_APP_ID, ADZUNA_API_KEY,
    SUPABASE_URL, SUPABASE_SERVICE_KEY
  } = process.env;

  if (!ADZUNA_APP_ID || !ADZUNA_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "Missing required env vars" });
  }

  const QUERIES = [
    `"entry level" OR warehouse OR "picker packer" OR logistics`,
    `"entry level" OR culinary OR "prep cook" OR "line cook" OR "food service" OR dishwasher`,
    `"entry level" OR retail OR cashier OR "customer service" OR receptionist`,
    `"entry level" OR healthcare OR "medical assistant" OR "patient care" OR "rehab aide"`,
    `"entry level" OR manufacturing OR production OR assembler OR "machine operator"`
  ];
  const WHERE = "Mercer County, New Jersey";
  const DAYS = "3";
  const LIMIT = "100";
  const PAGE = "1";
  const country = "us";

  const BAD_TITLE_WORDS = ["bitcoin","crypto","forex","nft","escort","adult","training fee","deposit required"];
  const TRUSTED_HOSTS = new Set(["indeed.com","ziprecruiter.com","glassdoor.com","linkedin.com","adzuna.com"]);
  const MIN_HOURLY = 12, MAX_HOURLY = 60;

  const wageFromAnnual = a => (a && !isNaN(a)) ? a/2080 : null;
  const hostFromUrl = u => { try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ""; } };
  const hasBadTitle = t => BAD_TITLE_WORDS.some(w => (t||"").toLowerCase().includes(w));
  const plausible = h => (h==null) || (h >= MIN_HOURLY && h <= MAX_HOURLY);

  const fetchAdzuna = async (q) => {
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${PAGE}`);
    url.searchParams.set("app_id", ADZUNA_APP_ID);
    url.searchParams.set("app_key", ADZUNA_API_KEY);
    url.searchParams.set("results_per_page", LIMIT);
    url.searchParams.set("what", q);
    url.searchParams.set("where", WHERE);
    url.searchParams.set("max_days_old", DAYS);
    url.searchParams.set("sort_by", "date");
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Adzuna ${r.status} ${await r.text()}`);
    const data = await r.json();
    return data.results || [];
  };

  const normalizeRow = (j) => {
    const loH = wageFromAnnual(j.salary_min);
    const hiH = wageFromAnnual(j.salary_max);
    const midpoint = loH && hiH ? (loH+hiH)/2 : (loH ?? hiH ?? null);
    const url = j.redirect_url || null;
    const srcHost = hostFromUrl(url);
    const loc = j.location?.display_name || "";

    const flagged = [];
    if (!plausible(midpoint)) flagged.push("implausible_wage");
    if (hasBadTitle(j.title || "")) flagged.push("bad_title_words");
    if (url && srcHost && !TRUSTED_HOSTS.has(srcHost)) flagged.push(`untrusted_source:${srcHost}`);

    return {
      title: j.title || null,
      company: j.company?.display_name || null,
      location: loc || null,
      description: j.description || null,
      apply_link: url,
      is_active: true,
      expiration_date: null,
      industry: j.category?.label || null,
      wage: midpoint,

      source: "adzuna",
      external_id: j.id,
      created_at_external: j.created || j.created_at || null,
      county: "Mercer",
      state: "NJ",
      ingested_at: new Date().toISOString(),

      reviewed: false,
      approved: flagged.length === 0,
      flagged_reasons: flagged
    };
  };

  try {
    const all = (await Promise.all(QUERIES.map(fetchAdzuna))).flat();

    // drop incomplete rows and dedupe by external_id
    const seen = new Set();
    const rows = [];
    for (const j of all) {
      if (!j?.id || seen.has(j.id)) continue;
      if (!j.title || !j.company?.display_name || !j.redirect_url) continue;
      seen.add(j.id);
      rows.push(normalizeRow(j));
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/jobs?on_conflict=source,external_id`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify(rows)
    });
    if (!r.ok) throw new Error(`Supabase upsert ${r.status} ${await r.text()}`);

    res.status(200).json({ message: "Ingest complete", upserted_unique: rows.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
