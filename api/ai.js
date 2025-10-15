// /api/ai.js - Vercel Node.js Serverless Function
const fetch = require('node-fetch');

// --- Environment Variables (Set these in your hosting provider's dashboard) ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-latest';

// --- Hardcoded Data & Logic (Moved from frontend) ---

// Tier-0a: Authoritative data for specific program Q&A
const programsMap = [
    {
        id: "sora", name: "Unarmed SORA Security Training",
        keywords: ["sora", "security", "unarmed", "guard"],
        details: {
            Location: "Virtual (TASK Computer Lab), 72 ½ Escher St., Trenton, NJ 08609",
            Schedule: "9:00 AM – 5:00 PM (two consecutive days)",
            Duration: "2 days",
            "Purpose/Outcomes": "Prepares you for the NJ Unarmed Security Officer license and qualifies you for entry-level security jobs. TASK assists with registration, fingerprinting, and job referrals.",
            Eligibility: "18+, complete application, attend a mandatory info session, no criminal/misdemeanor convictions, no active warrants.",
            Cost: "Free (covered by TASK).",
            "Next Start Date": "TBD",
            "Sign-Up Link": "https://forms.office.com/r/4j7x4kY7wu",
            "Contact Info": "EandE@trentonsoupkitchen.org or 609-697-6215",
        }
    },
    {
        id: "culinary", name: "Emilio’s Culinary Academy",
        keywords: ["emilio culinary", "culinary academy", "cooking", "chef", "servsafe"],
        details: {
            Location: "Trenton Area Soup Kitchen, 72 ½ Escher St., Trenton, NJ 08609",
            Duration: "10 weeks (8 weeks class + 2-week internship)",
            "Purpose/Outcomes": "Hands-on kitchen skills, life skills, digital literacy, and job readiness, culminating in ServSafe® Food Manager certification and job placement support.",
            Eligibility: "18+, no convictions for sexual offenses or arson. Must commit to the training and cannot take SORA simultaneously.",
            Cost: "Free (covered by TASK).",
            "Next Start Date": "Application will open in November.",
            "Sign-Up Link": "https://forms.office.com/r/Me7avaaXWx",
            "Contact Info": "EandE@trentonsoupkitchen.org or 609-697-6215",
        }
    },
    {
        id: "forklift", name: "Forklift Certification Class",
        keywords: ["forklift", "warehouse", "logistics"],
        details: {
            Location: "TASK Conference Room, 72 ½ Escher St., Trenton, NJ 08609",
            Schedule: "2:00–4:00 PM (single session)",
            Duration: "1 day (2 hours)",
            "Purpose/Outcomes": "Prepares you for the written portion of the forklift operator test. Most employers provide hands-on training on the job.",
            Eligibility: "18+",
            Cost: "Free (covered by TASK).",
            "Next Start Date": "October 14th at 2 pm",
            "Sign-Up Link": "https://forms.office.com/r/pXe4G2y0JH",
            "Contact Info": "Call 609-697-6215 or 609-697-6166 for more information",
        }
    }
];

// Tier-0b: General hardcoded intents
function matchHardcoded(query) {
    const q = query.toLowerCase();
    const intents = {
        appointments: { keywords: ['appointment', 'schedule', 'meet'], html: "To schedule an appointment for job or training support, please call the Social Services Specialist at **609-337-1624**. We don't accept walk-ins, so be sure to call first! Your first meeting will be to create an Individual Employment Plan (IEP)." },
        jobs: { keywords: ['job', 'employment', 'career'], html: `TASK's Employment & Education Program can help you find a job. We offer resume building, job search assistance, and interview preparation. Please call the Social Services Specialist at **609-337-1624** to make an appointment.`},
        bus: { keywords: ['bus ticket', 'transportation'], html: "We provide bus tickets for the first two weeks of employment, and for orientations or interviews, but only for those who have completed an Individual Employment Plan (IEP) with us first." },
        crisis: { keywords: ['crisis', 'suicide', 'help now'], html: "If you are in a crisis, please reach out. Help is available.\n\n* **National Suicide Prevention Lifeline:** 988\n* **Mercer County Crisis Intervention:** 609-396-4357" },
        careertips: { keywords: ['career tips', 'resume', 'interview'], html: "Here are some top career tips:\n\n* **Build a Strong Resume:** Highlight your skills and experience clearly.\n* **Practice Interview Skills:** Prepare for common questions using the STAR method.\n* **Network:** Connect with people in your desired field.\n\nFor more, check out our [Career Tips page](https://bycell.co/ddmui)." }
    };
    for (const intent in intents) {
        if (intents[intent].keywords.some(k => q.includes(k))) {
            return { id: intent, html: intents[intent].html };
        }
    }
    return null;
}
