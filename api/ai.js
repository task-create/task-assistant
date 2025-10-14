// /api/ai.js - Vercel Node.js Serverless Function

// Using require for node-fetch as this is a Node.js serverless environment
const fetch = require('node-fetch');

// --- Environment Variables (Set these in your hosting provider's dashboard) ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';

// --- Hardcoded Data & Logic (Moved from frontend) ---

// Tier-0a: Authoritative data for specific program Q&A
const programsMap = [
    {
        id: "sora",
        name: "Unarmed SORA Security Training",
        keywords: ["sora", "security", "unarmed", "guard", "guard card", "security officer", "security training", "security license"],
        location: "Virtual (TASK Computer Lab), 72 ½ Escher St., Trenton, NJ 08609",
        schedule: "9:00 AM – 5:00 PM (two consecutive days)",
        duration: "2 days",
        purpose_outcomes: "Prepares you for NJ Unarmed Security Officer license; qualifies you for entry-level security jobs statewide. TASK assists with registration, fingerprinting, and job referrals.",
        eligibility: "18+, complete application + mandatory info session, no criminal/misdemeanor convictions, no active warrants.",
        cost: "Free (covered by TASK).",
        next_start_date: "TBD",
        signup_link: "https://forms.office.com/r/4j7x4kY7wu",
        contact_info: "(609) 337-1624",
        instructor: "TASK staff / SORA 100 instructors",
    },
    {
        id: "culinary",
        name: "Emilio’s Culinary Academy",
        keywords: ["emilio culinary", "culinary academy", "culinary", "cooking", "servsafe"],
        location: "Trenton Area Soup Kitchen, 72 ½ Escher St., Trenton, NJ 08609",
        duration: "10 weeks (8 weeks class + 2-week internship)",
        purpose_outcomes: "Hands-on kitchen skills, life skills, digital literacy, job readiness; ends with ServSafe® Food Manager certification and job placement support.",
        eligibility: "18+, no convictions for sexual offenses or arson. Must commit to the training; cannot take SORA simultaneously.",
        cost: "Free (covered by TASK).",
        next_start_date: "Application will open in November.",
        signup_link: "https://forms.office.com/r/Me7avaaXWx",
        contact_info: "(609) 337-1624",
    },
    {
        id: "forklift",
        name: "Forklift Certification Class",
        keywords: ["forklift", "warehouse", "logistics", "fork lift"],
        location: "TASK Conference Room, 72 ½ Escher St., Trenton, NJ 08609",
        schedule: "2:00–4:00 PM (single session)",
        duration: "1 day (2 hours)",
        purpose_outcomes: "Prepares you for the written portion of the forklift operator test; most employers provide hands-on training on the job.",
        eligibility: "18+",
        cost: "Free (covered by TASK).",
        next_start_date: "October 14th at 2 pm",
        signup_link: "https://forms.office.com/r/pXe4G2y0JH",
        contact_info: "(609) 697-6215 or (609) 697-6166",
    }
];

// Tier-0b: General hardcoded intents
function matchHardcoded(query) {
    const q = query.toLowerCase();
    const intents = {
        appointments: { keywords: ['appointment', 'schedule', 'meet'], html: "To schedule an appointment related to a job or training, please call the Social Services Specialist at 609-337-1624. We don't accept walk-ins for appointments, so be sure to call first! Everyone has a meeting for an Individual Employment Plan (IEP) to get started." },
        jobs: { keywords: ['job', 'employment', 'career'], html: `TASK's Work & Education Program can help you find a job. We offer resume building, job search assistance, and interview preparation. Please call the Social Services Specialist at 609-337-1624 to make an appointment.`},
        bus: { keywords: ['bus ticket', 'transportation'], html: "We provide bus tickets for the first two weeks of employment, and for orientations or interviews, but only for those who have completed an Individual Employment Plan (IEP) with us first." },
        crisis: { keywords: ['crisis', 'suicide', 'help now'], html: "If you are in a crisis, please reach out. Help is available.<br>• National Suicide Prevention Lifeline: 988<br>• Mercer County Crisis Intervention: 609-396-4357" },
        careertips: { keywords: ['career tips', 'resume tip', 'interview tip'], html: "Here are some top career tips: <br>• Build a strong resume highlighting your skills. <br>• Practice for interviews using the STAR method. <br>• Network with people in your field. <br>For more, check out our Career Tips page: https://bycell.co/ddmui" }
    };
    for (const intent in intents) {
        if (intents[intent].keywords.some(k => q.includes(k))) {
            return { id: intent, html: intents[intent].html };
        }
    }
    return null;
}


// --- Tiered Logic Helpers ---

function findProgram(prompt = "") {
    const t = prompt.toLowerCase();
    return programsMap.find(p => p.keywords.some(k => t.includes(k.toLowerCase())));
}

function qType(p = "") {
    p = p.toLowerCase();
    if (/\b(who|instructor|teacher)\b/.test(p)) return "who";
    if (/\b(where|location|address)\b/.test(p)) return "where";
    if (/\b(why|benefit|outcome|purpose)\b/.test(p)) return "why";
    if (/\b(how long|duration|weeks|hours)\b/.test(p)) return "howlong";
    if (/\b(when|next|date)\b/.test(p)) return "when";
    if (/\b(cost|price|fee)\b/.test(p)) return "cost";
    if (/\b(requirements?|eligibility)\b/.test(p)) return "eligibility";
    return "general";
}

function formatProgramAnswer(p, type) {
    let parts = [];
    const add = (label, v) => v && parts.push(`**${label}:** ${v}`);

    switch (type) {
        case "who": add(p.name, p.instructor); break;
        case "where": add(p.name, p.location); break;
        case "why": add(p.name, p.purpose_outcomes); break;
        case "howlong": add("Duration", p.duration); add("Schedule", p.schedule); break;
        case "when": add("Next start", p.next_start_date || "TBD"); break;
        case "cost": add("Cost", p.cost); break;
        case "eligibility": add("Eligibility", p.eligibility); break;
        default: // General summary
            add(p.name, p.purpose_outcomes);
            add("Duration", p.duration);
            add("Next start", p.next_start_date || "TBD");
            add("Eligibility", p.eligibility);
            add("Cost", p.cost);
    }

    const footer = [
        p.signup_link ? `Sign up here: ${p.signup_link}` : "",
        p.contact_info ? `For questions, contact: ${p.contact_info}` : ""
    ].filter(Boolean).join("\n");

    return (parts.join("\n") + (footer ? `\n\n${footer}` : ""));
}

// --- Gemini API Call ---
async function callGemini(payload) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const error = await response.json();
        console.error('Upstream API Error:', error);
        throw new Error('Error from Gemini API');
    }
    return response.json();
}

// --- Main Handler ---
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
    if (!KEY) return res.status(500).json({ error: 'API key not configured on server.' });

    try {
        const { contents } = req.body;
        if (!contents) return res.status(400).json({ error: 'Missing "contents" in request body.' });

        const prompt = contents[0]?.parts[0]?.text || "";

        // Tier 0a: Program-specific Q&A
        const prog = findProgram(prompt);
        if (prog) {
            const type = qType(prompt);
            const text = formatProgramAnswer(prog, type);
            return res.status(200).json({
                candidates: [{ content: { parts: [{ text }] } }],
                _source: `hardcoded:program:${prog.id}:${type}`
            });
        }
        
        // Tier 0b: Hardcoded intents
        const hard = matchHardcoded(prompt);
        if (hard?.html) {
             return res.status(200).json({
                candidates: [{ content: { parts: [{ text: hard.html }] } }],
                _source: `hardcoded:intent:${hard.id}`
            });
        }

        // Tier 2: Gemini Fallback
        const geminiResponse = await callGemini({ contents });
        geminiResponse._source = 'gemini';
        return res.status(200).json(geminiResponse);

    } catch (err) {
        console.error('Server-side error:', err);
        return res.status(502).json({ error: 'Server-side processing failed.', detail: String(err) });
    }
};

