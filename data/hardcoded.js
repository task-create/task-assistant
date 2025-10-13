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
      "Holidays (when Mon–Sat): Memorial Day, Independence Day, Labor Day, Thanksgiving, Christmas Eve, Christmas Day, New Year’s Eve, New Year’s Day"
    ],
  },

  // Program meta used to answer who/where/why/how long/when/cost/eligibility
  programsMeta: [
    {
      key: "sora",
      names: ["sora","unarmed security","security officer","guard card","security license"],
      label: "2-Day Unarmed SORA Security Training",
      location: "TASK Computer Lab (virtual instruction)",
      schedule: "9:00 AM – 5:00 PM (two days)",
      duration: "2 days",
      purpose_outcomes:
        "Prepares you to become a licensed security officer in New Jersey; covers all required SORA topics. Staff assist with registration, fingerprinting, and job referrals.",
      instructor: "TASK staff / partner instructors",
      eligibility:
        "18+; complete application & mandatory info session; no criminal or misdemeanor convictions and no active warrants.",
      cost: "Free (covered by TASK).",
      next_start_date: "TBD",
      app_window: "TBD",
      signup_link: "https://forms.office.com/r/4j7x4kY7wu",
      contact_info: "(609) 337-1624",
      notes:
        "If selected for SORA, you cannot enroll in the Emilio Culinary Academy at the same time."
    },
    {
      key: "culinary",
      names: ["emilio culinary","emilio’s culinary","culinary academy","cooking program","food service","servsafe"],
      label: "Emilio’s Culinary Academy",
      location: "Trenton Area Soup Kitchen (Escher St.)",
      schedule: "See cohort schedule; 8 weeks instruction + 2-week internship",
      duration: "10 weeks",
      purpose_outcomes:
        "Hands-on kitchen instruction, life skills, digital literacy, job readiness; ServSafe® Food Manager certification; job placement support.",
      instructor: "Experienced chefs and culinary instructors",
      eligibility:
        "18+; cannot accept individuals with convictions for sexual offenses or arson.",
      cost: "Free (covered by TASK).",
      next_start_date: "2025-10-08",
      app_window: "Application open Sept 25 – Oct 1",
      signup_link: "https://forms.office.com/r/Me7avaaXWx",
      contact_info: "(609) 337-1624",
      notes:
        "If selected for Culinary, you cannot enroll in the SORA Security Program at the same time."
    },
    {
      key: "forklift",
      names: ["forklift","fork lift","warehouse","logistics","forklift certification"],
      label: "Forklift Certification Class",
      location: "TASK Conference Room",
      schedule: "2:00–4:00 PM (one day)",
      duration: "1 day",
      purpose_outcomes:
        "Focuses on the written operator test. Many employers provide hands-on training on the job. On-site instruction can be arranged with our certified instructor if your employer requires it.",
      instructor: "TASK certified instructor",
      eligibility: "Open to motivated participants pursuing warehouse/logistics roles.",
      cost: "Free.",
      next_start_date: "TBD",
      app_window: "TBD",
      signup_link: "https://forms.office.com/r/pXe4G2y0JH",
      contact_info: "(609) 337-1624",
      notes: ""
    }
  ],

  intents: [
    // Appointments
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

    // SORA quick card
    {
      id: "training_sora",
      keywords: ["sora","security","unarmed","guard card","security license","security officer training"],
      html: () =>
        [
          "🛡️ **2-Day Unarmed SORA Security Training**",
          "• Location: TASK Computer Lab (virtual)",
          "• Time: 9:00 AM – 5:00 PM (two days)",
          "• Outcome: Licensed security officer prep; TASK helps with registration, fingerprinting, job referrals",
          "• Eligibility: 18+, application & info session; **no criminal/misdemeanor convictions and no active warrants**",
          "• Next class: **TBD**",
          "• Apply: https://forms.office.com/r/4j7x4kY7wu",
          "• Training hub: https://bycell.co/ddmtn",
          "• Note: Not eligible to take Culinary at the same time."
        ].join("\n")
    },

    // Culinary quick card
    {
      id: "training_culinary",
      keywords: ["emilio culinary","culinary academy","cooking program","food service","servsafe","emilio’s culinary","emilios culinary"],
      html: () =>
        [
          "👨🏿‍🍳 **Emilio’s Culinary Academy** (10 weeks, free)",
          "• 8 weeks instruction + 2-week internship; ServSafe® certification; job supports",
          "• Eligibility: 18+; **cannot accept convictions for sexual offenses or arson**",
          "• Application window: **Sept 25 – Oct 1**",
          "• Next class: **Oct 8, 2025**",
          "• Apply: https://forms.office.com/r/Me7avaaXWx",
          "• Training hub: https://bycell.co/ddmtn",
          "• Note: Not eligible to take SORA at the same time."
        ].join("\n")
    },

    // Forklift quick card
    {
      id: "training_forklift",
      keywords: ["forklift","warehouse","logistics","certification","fork lift"],
      html: () =>
        [
          "🚜 **Forklift Certification Class** (1 day, written test prep)",
          "• When: 2:00–4:00 PM",
          "• Where: TASK Conference Room",
          "• Sign up: https://forms.office.com/r/pXe4G2y0JH",
          "• Note: Most employers train hands-on on the job; on-site instruction can be arranged if needed."
        ].join("\n")
    },

    // Events
    {
      id: "events",
      keywords: ["event","workshop","info session","orientation","resume","interview","communication","career tips","star method"],
      html: () =>
        [
          "We don’t have upcoming events posted right now. Typical sessions include:",
          "• SORA info sessions",
          "• Resume, interview, communication skills, STAR Method, job search safety",
          "",
          "Updates: https://bycell.co/ddmul"
        ].join("\n")
    },

    // Employment Services
    {
      id: "employment",
      keywords: ["job","jobs","employment","resume","interview","work","career services","job board","help finding job"],
      html: () =>
        [
          "💼 **Employment Services at TASK**",
          "• Career guidance, job search support, resume & interview prep",
          "• Job board: https://bycell.co/ddmtq",
          "• Talk with Employment Services: **(609) 337-1624**",
          "• Suspicious posting? Screenshot and text **(609) 697-6215** or **(609) 697-6166**",
          "• We’ll start with an **IEP** appointment."
        ].join("\n")
    },

    // Community Resources
    {
      id: "resources",
      keywords: ["resource","resources","help","housing","food","legal","childcare","case management","creative arts","patron services","hygiene","mail services","glasses"],
      html: () =>
        [
          "🧭 **Community & TASK Resources**",
          "• All resources: https://bycell.co/ddmua",
          "• Other TASK services: https://bycell.co/ddmud",
          "",
          "🧑‍🍳 Meal Service: https://trentonsoupkitchen.org/meal-service/",
          "🤝 Case Management: https://trentonsoupkitchen.org/case-management/ (call the Social Services Specialist first)",
          "🎨 Creative Arts Program: https://trentonsoupkitchen.org/creative-arts-program/",
          "   – Music Mondays 11 am–1 pm",
          "   – Visual Arts Tue 10:30 am–1 pm",
          "   – SHARE Creative Writing Thu 11:30 am–1 pm",
          "📦 Patron Services: hygiene, mail service, OTC meds, clothing; during meal service Mon–Fri 10:30 am–1 pm and Mon–Thu 3:30–5 pm"
        ].join("\n")
    },

    // NJ TRANSIT (chat flow asks origin → destination)
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

    // Crisis / De-escalation
    {
      id: "crisis",
      keywords: ["suicide","kill myself","self harm","overwhelmed","abuse","harassed","crisis","panic","depressed","emergency"],
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

// ----------------------------- matchers -----------------------------
const norm = s => (s||"").toLowerCase();

export function matchHardcoded(userText, opts={}) {
  const t = norm(userText);
  // Training intent by program keyword (for wh-questions we still want the right program)
  const program = answerBank.programsMeta.find(p =>
    p.names.some(n => t.includes(norm(n)))
  );

  // Intent quick-cards
  for (const intent of answerBank.intents) {
    if (intent.keywords.some(k => t.includes(norm(k)))) {
      if (intent.id === "transit") {
        return { id:intent.id, html: intent.html?.(opts.origin, opts.destination) };
      }
      // If the intent is training_* but we also matched a program, prefer program-aware path
      if (intent.id.startsWith("training_") && program) {
        return { id:"training_program", program };
      }
      return { id:intent.id, html: intent.html?.() };
    }
  }

  // If the user mentioned a program name but not generic “training” words, still match program.
  if (program) return { id:"training_program", program };

  return null;
}

// classify wh-question type
export function classifyTrainingQ(text) {
  const p = norm(text);
  if (/\bwho\b/.test(p)) return "who";
  if (/\bwhere\b/.test(p)) return "where";
  if (/\bwhy\b|\bwhat (do|will) i (learn|get)\b|outcome|cert/i.test(p)) return "why";
  if (/\bhow long\b|weeks|hours|duration/i.test(p)) return "howlong";
  if (/\bwhen\b|next (start|class|cohort|session)/i.test(p)) return "when";
  if (/\bhow much\b|cost|price|tuition/i.test(p)) return "cost";
  if (/\brequirements?\b|eligibility|qualifications?/i.test(p)) return "eligibility";
  return "general";
}
