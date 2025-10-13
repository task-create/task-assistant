// /data/hardcoded.js
// TASK Tier-0 knowledge: fast canned answers used BEFORE Supabase/Gemini.

export const answerBank = {
  org: {
    name: "Trenton Area Soup Kitchen (TASK)",
    site: "http://www.trentonsoupkitchen.org/",
    phone: "(609)-695-5456",
    address: "72 1/2 Escher Street, Trenton, NJ 08609",
    hours: [
      "Lunch: Mon–Sat, 10:30 am – 1 pm",
      "Dinner: Mon–Thu, 3:30 pm – 5 pm",
      "Holidays served when Mon–Sat: Memorial Day, Independence Day, Labor Day, Thanksgiving, Christmas Eve, Christmas Day, New Year’s Eve, New Year’s Day"
    ],
  },

  intents: [
    // ---------------- Appointments ----------------
    {
      id: "appointments",
      keywords: [
        "appointment","book","schedule","meet","call specialist","case management",
        "social worker","iep","employment plan","see someone","consultation"
      ],
      html: () =>
        [
          "To make an appointment, please **call the Social Services Specialist** — we don’t accept walk-ins.",
          "• Phone: (609)-337-1624",
          "• Everyone starts with an **Individual Employment Plan (IEP)**. After that, we’ll schedule time with the Employment Assistant as needed.",
          "• **Bus tickets** may be provided **only** after an IEP, and only for **interviews/orientations** or the **first two weeks of new employment**.",
          "",
          "Before we book, I’ll ask for:",
          "• Your reason/type of appointment",
          "• Preferred date/time windows",
          "• In-person vs. phone/virtual",
          "",
          "If online scheduling works better for you: https://bycell.co/ddncs"
        ].join("\n")
    },

    // ---------------- Trainings: SORA ----------------
    {
      id: "training_sora",
      keywords: [
        "sora","security","unarmed","guard card","security license","security officer training"
      ],
      html: () =>
        [
          "🛡️ **2-Day Unarmed SORA Security Training** (free)",
          "• Where: TASK Computer Lab (virtual instruction), 9:00 am–5:00 pm",
          "• What: All required SORA topics to become a licensed security officer in NJ. TASK covers class & certification costs and can help with fingerprinting and job referrals.",
          "• Eligibility: 18+, complete the application & info session, **no criminal/misdemeanor convictions and no active warrants**.",
          "• If selected for SORA, you **cannot** enroll in the Emilio Culinary Academy at the same time.",
          "• **Next class:** TBD",
          "• **Apply:** https://forms.office.com/r/4j7x4kY7wu",
          "• More info / general training page: https://bycell.co/ddmtn"
        ].join("\n")
    },

    // ---------------- Trainings: Culinary ----------------
    {
      id: "training_culinary",
      keywords: [
        "emilio culinary","culinary academy","cooking program","food service","servsafe",
        "emilio’s culinary academy","emilios culinary"
      ],
      html: () =>
        [
          "👨🏿‍🍳 **Emilio’s Culinary Academy** (free, 10 weeks)",
          "• 8 weeks hands-on culinary instruction + 2-week internship",
          "• Wraparound support: resume help, case management, job referrals",
          "• Graduates often work with Sodexo, Princeton University Dining, Capital Health, and more",
          "• **Eligibility:** 18+, **no convictions for sexual offenses or arson**",
          "• If selected for Culinary, you **cannot** enroll in SORA at the same time",
          "• **Next class:** TBD (applications likely open in November)",
          "• **Apply:** https://forms.office.com/r/Me7avaaXWx",
          "• More info / general training page: https://bycell.co/ddmtn"
        ].join("\n")
    },

    // ---------------- Trainings: Forklift ----------------
    {
      id: "training_forklift",
      keywords: [
        "forklift","warehouse","logistics","certification","fork lift"
      ],
      html: () =>
        [
          "🚜 **Forklift Certification Class** (1 day, written test prep)",
          "• When: **Oct 14, 2:00–4:00 pm**, TASK Conference Room",
          "• Focus: Written portion of the operator test. Most employers train hands-on on the job; if your employer needs on-site training, our instructor can visit the job site.",
          "• **Sign up:** https://forms.office.com/r/pXe4G2y0JH"
        ].join("\n")
    },

    // ---------------- Events (generic) ----------------
    {
      id: "events",
      keywords: [
        "event","workshop","info session","orientation","resume class","interview class",
        "communication","career tips","star method"
      ],
      html: () =>
        [
          "We don’t have upcoming events posted right now. Typical sessions include:",
          "• SORA info sessions",
          "• Resume, interview, communication skills, STAR Method, job search safety",
          "",
          "Keep an eye here for updates: https://bycell.co/ddmul"
        ].join("\n")
    },

    // ---------------- Employment Services ----------------
    {
      id: "employment",
      keywords: [
        "job","jobs","employment","resume","interview","work","help finding job",
        "career services","employment services","job board"
      ],
      html: () =>
        [
          "💼 **Employment Services at TASK**",
          "• Career guidance, job search support, resume & interview prep",
          "• **Job board:** https://bycell.co/ddmtq",
          "• To talk with Employment Services, call **(609) 337-1624**",
          "• If you see a suspicious job posting, screenshot it and text **(609) 697-6215** or **(609) 697-6166**",
          "• (Heads-up: We’ll start with an **IEP** appointment before deeper services.)"
        ].join("\n")
    },

    // ---------------- Community Resources ----------------
    {
      id: "resources",
      keywords: [
        "resource","resources","help","housing","food","legal","childcare","case management",
        "creative arts","patron services","hygiene","mail services","glasses"
      ],
      html: () =>
        [
          "🧭 **Community & TASK Resources**",
          "• All resources: https://bycell.co/ddmua",
          "• Other TASK services: https://bycell.co/ddmud",
          "",
          "🧑‍🍳 **Meal Service:** https://trentonsoupkitchen.org/meal-service/",
          "🤝 **Case Management:** https://trentonsoupkitchen.org/case-management/ (call the Social Services Specialist first)",
          "🎨 **Creative Arts Program:** https://trentonsoupkitchen.org/creative-arts-program/",
          "   – Music Mondays 11 am–1 pm",
          "   – Visual Arts Tue 10:30 am–1 pm",
          "   – SHARE Creative Writing Thu 11:30 am–1 pm",
          "📦 **Patron Services:** hygiene items, mail service, OTC meds, clothing; during meal service Mon–Fri 10:30 am–1 pm and Mon–Thu 3:30–5 pm"
        ].join("\n")
    },

    // ---------------- NJ TRANSIT ----------------
    {
      id: "transit",
      keywords: ["nj transit","trip planner","bus","train","route","schedule","transit"],
      html: (origin, dest) => {
        const o = encodeURIComponent(origin || "72 1/2 Escher Street, Trenton, NJ 08609");
        const d = dest ? encodeURIComponent(dest) : "";
        const njt = d
          ? `https://www.njtransit.com/trip-planner?from=${o}&to=${d}&mode=transit`
          : "https://www.njtransit.com/trip-planner-to";
        const g = d
          ? `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=transit`
          : `https://www.google.com/maps/dir/?api=1&origin=${o}&travelmode=transit`;
        return [
          "🚌 **Trip planning**",
          `• NJ TRANSIT: ${njt}`,
          `• Google Maps (Transit): ${g}`,
          "Ask me for a pre-filled link by sending: “from [origin] to [destination]”."
        ].join("\n");
      }
    },

    // ---------------- Crisis / De-escalation ----------------
    {
      id: "crisis",
      keywords: [
        "suicide","kill myself","self harm","overwhelmed","abuse","harassed",
        "crisis","panic","depressed","emergency"
      ],
      html: () =>
        [
          "If you’re in crisis or feel unsafe:",
          "• **Call 988** (24/7) or 911 for immediate danger",
          "• TASK help lines: **(609) 697-6215** or **(609) 697-6166** (business hours)",
          "You’re not alone. We’re here to help connect you to support."
        ].join("\n")
    },
  ]
};

// ----------------------------- matcher -----------------------------
const norm = s => (s||"").toLowerCase();

export function matchHardcoded(userText, opts={}) {
  const t = norm(userText);
  for (const intent of answerBank.intents) {
    if (intent.keywords.some(k => t.includes(norm(k)))) {
      if (intent.id === "transit") {
        return { id:intent.id, html: intent.html?.(opts.origin, opts.destination) };
      }
      return { id:intent.id, html: intent.html?.() };
    }
  }
  return null;
}
