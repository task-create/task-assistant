// /api/events.js
// Returns upcoming TASK or community events from Supabase

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    // Adjust query based on your table — assumes:
    // id, name, description, date, time, location, signup_link
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,name,description,date,time,location,signup_link&order=date.asc`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });

    if (!resp.ok) {
      const msg = await resp.text();
      throw new Error(`Supabase error: ${msg}`);
    }

    const events = await resp.json();
    const today = new Date().toISOString().split("T")[0];
    const upcoming = events.filter(e => !e.date || e.date >= today);

    res.status(200).json(upcoming);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: err.message });
  }
}
