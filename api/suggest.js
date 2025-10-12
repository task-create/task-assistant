// /api/suggest.js
// TASK Assistant - Suggestion Engine
// Detects tone, frustration, and language; routes user to correct resource

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    // --- 1️⃣ Language & Tone Detection ---
    const detect = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Analyze this text and return JSON with:
                  {
                    "language": "English/Spanish/Haitian Creole/Other",
                    "frustration_level": "low/medium/high",
                    "emotion": "neutral/angry/sad/anxious/hopeful",
                    "intent": "job help/training/support/appointment/other"
                  }
                  Text: """${message}"""`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await detect.json();
    const analysisText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      analysis = { language: "English", frustration_level: "low", intent: "other" };
    }

    // --- 2️⃣ Smart Suggestion Routing ---
    let suggestion = "";
    switch (analysis.intent?.toLowerCase()) {
      case "job help":
        suggestion =
          "💼 It sounds like you’re looking for job help. You can view openings on the [Mercer County Job Board](https://task-assistant-xi.vercel.app/jobs) or visit TASK’s Employment Services for one-on-one assistance.";
        break;
      case "training":
        suggestion =
          "🎓 You can explore TASK’s free training programs like the [Emilio Culinary Program](https://bycell.co/ddmtn), [SORA Security Training](https://bycell.co/ddmtn), or [Forklift Certification](https://bycell.co/ddmtn).";
        break;
      case "support":
        suggestion =
          "🧭 It sounds like you may need support services. Check [Community Resources](https://task-assistant-xi.vercel.app/resources) for housing, transportation, and more.";
        break;
      case "appointment":
        suggestion =
          "📅 You can schedule an appointment directly through [TASK’s Appointment Page](https://bycell.co/ddmtn).";
        break;
      default:
        suggestion =
          "🤝 You can explore job opportunities, training, or support at TASK anytime through the main [Employment Services Hub](https://task-assistant-xi.vercel.app).";
    }

    // --- 3️⃣ Frustration Response ---
    if (analysis.frustration_level === "high") {
      suggestion =
        "💬 It sounds like you’re feeling frustrated. TASK is here to help — would you like to speak with a staff member directly? You can reach us at (609) 695-5456 or visit our Employment Services desk.";
    }

    // --- 4️⃣ Multilingual Support ---
    if (analysis.language === "Spanish") {
      suggestion +=
        "\n\n🌐 **Idioma:** Parece que hablas español. TASK ofrece apoyo en español para la mayoría de los programas y recursos.";
    } else if (analysis.language === "Haitian Creole") {
      suggestion +=
        "\n\n🌐 **Lang:** Nou gen sipò an Kreyòl pou ede ou ak sèvis travay ak fòmasyon nan TASK.";
    }

    res.status(200).json({
      text: suggestion,
      analysis,
      source: "suggest.js",
    });
  } catch (err) {
    console.error("Suggest API error:", err);
    res.status(500).json({ error: err.message });
  }
}
