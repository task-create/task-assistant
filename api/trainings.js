// File: /api/trainings.js
// Purpose: Lightweight Supabase endpoint for trainings list
// Fixes the 504 timeout by limiting query size, fields, and filters.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  // --- CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    // --- Select only essential columns for faster response
    const fields = `
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
      start_date_note,
      start_at
    `;

    const { data, error } = await supabase
      .from("trainings")
      .select(fields)
      // only show trainings that are active
      .eq("is_active", true)
      // filter out old sessions
      .gte("next_start_date", new Date().toISOString().split("T")[0])
      // sort by soonest date
      .order("next_start_date", { ascending: true })
      // safety limit
      .limit(20);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    // --- Clean response (remove nulls, format date)
    const cleaned = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      is_active: row.is_active,
      next_start_date: row.next_start_date,
      app_window_start: row.app_window_start,
      app_window_END: row.app_window_END,
      schedule: row.schedule,
      signup_link: row.signup_link,
      contact_info: row.contact_info,
      duration: row.duration,
      start_date_note: row.start_date_note,
    }));

    return res.status(200).json(cleaned);
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
