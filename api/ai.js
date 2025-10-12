// /api/ai.js
// TASK Assistant: prioritizes Supabase data (trainings, jobs, resources) before using Gemini.

import fetch from "node-fetch";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    // 1️⃣ Try to match TASK Trainings
    const trainingResp = await fetch(`${SUPABASE_URL}/rest/v1/trainings?select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const trainings = await trainingResp.json();

    const training = trainings.find(t =>
      prompt.toLowerCase().includes(t.name?.toLowerCase())
    );

    if (training) {
      return res.status(200).json({
        text: `📋 **${training.name}**\n\n${training.description || ""}\n\n` +
              (training.next_start_date ? `🗓 **Next Start Date:** ${training.next_start_date}\n` : "") +
              (training.signup_link ? `🔗 **Sign Up:** ${training.signup_link}\n` : "") +
              (training.contact_info ? `📞 **Contact:** ${training.contact_info}\n` : "") +
              (training.schedule ? `🕘 **Schedule:** ${training.schedule}\n` : ""),
        source: "supabase-trainings"
      });
    }

    // 2️⃣ Try to match Jobs
    const jobResp = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const jobs = await jobResp.json();

    const job = jobs.find(j =>
      prompt.toLowerCase().includes(j.name?.toLowerCase() || j.title?.toLowerCase())
    );

    if (job) {
      return res.status(200).json({
        text: `💼 **${job.name || job.title}** at ${job.company || "local employer"}\n\n` +
              `${job.description || ""}\n\n` +
              (job.location ? `📍 ${job.location}\n` : "") +
              (job.apply_link ? `🔗 Apply: ${job.apply_link}\n` : ""),
        source: "supabase-jobs"
      });
    }

    // 3️⃣ Try to match Resources
    const resResp = await fetch(`${SUPABASE_URL}/rest/v1/resources?select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const resources = await resResp.json();

    const resource = resources.find(r =>
      prompt.toLowerCase().includes(r.name?.toLowerCase())
    );

    if (resource) {
      return res.status(200).json({
        text: `🧭 **${resource.name}**\n\n${resource.description || ""}\n\n` +
              (resource.phone_number ? `📞 ${resource.phone_number}\n` : "") +
              (resource.website ? `🌐 ${resource.website}\n` : ""),
        source: "supabase-resources"
      });
    }

    // 4️⃣ Fall back to Gemini if nothing found
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      }
    );
    const geminiData = await geminiResp.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    return res.status(200).json({ text, source: "gemini" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
