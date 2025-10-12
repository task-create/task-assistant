// /api/suggest.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const body = req.body || {};
    const text = (body.text || body.message || "").toString().trim();
    if (!text) return res.status(400).json({ error: "text required" });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash").replace(/^models\//, "");

    // Ask Gemini for tone + intent in JSON
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text:
`Return ONLY valid JSON:
{"language":"English|Spanish|Haitian Creole|Other",
 "frustration_level":"low|medium|high",
 "emotion":"neutral|angry|sad|anxious|hopeful",
 "intent":"job help|training|support|appointment|other"}
Text: """${text}"""` }]}]})
      }
    );

    const data = await r.json();
    const blob = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let analysis; try { analysis = JSON.parse(blob); } catch { analysis = {}; }

    // Suggestions
    const ENGAGE = {
      appointment: "https://bycell.co/ddncs",
      jobs:        "https://bycell.co/ddmtq",
      trainings:   "https://bycell.co/ddmtn",
      resources:   "https://bycell.co/ddmua",
    };

    let suggestion = "How can I help?";
    switch ((analysis.intent || "").toLowerCase()) {
      case "job help":
        suggestion = `💼 Looking for work? Check current openings: ${ENGAGE.jobs}`;
        break;
      case "training":
        suggestion = `🎓 Explore TASK trainings (Culinary, SORA, Forklift): ${ENGAGE.trainings}`;
        break;
      case "support":
        suggestion = `🧭 Community resources in Mercer County: ${ENGAGE.resources}`;
        break;
      case "appointment":
        suggestion = `📅 Schedule an appointment: ${ENGAGE.appointment}`;
        break;
      default:
        suggestion = `🤝 You can browse jobs, trainings, resources, or book an appointment:\n• Jobs: ${ENGAGE.jobs}\n• Trainings: ${ENGAGE.trainings}\n• Resources: ${ENGAGE.resources}\n• Appointments: ${ENGAGE.appointment}`;
    }

    if ((analysis.frustration_level || "").toLowerCase() === "high") {
      suggestion = "💬 I hear your frustration. A staff member can help directly — call (609) 695-5456 or visit TASK’s Employment Services desk.";
    }

    if ((analysis.language || "").toLowerCase() === "spanish") {
      suggestion += "\n\n🌐 **Idioma:** También podemos ayudar en español.";
    } else if ((analysis.language || "").toLowerCase().includes("haitian")) {
      suggestion += "\n\n🌐 **Lang:** Nou kapab ede w an Kreyòl tou.";
    }

    return res.status(200).json({ text: suggestion, analysis, source: "suggest" });
  } catch (err) {
    console.error("suggest error:", err);
    return res.status(500).json({ error: err.message });
  }
}
