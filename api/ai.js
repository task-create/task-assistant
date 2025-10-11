// /api/ai.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSupabase, ok, fail } from './supabase.js';

const VALID_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.5-pro-latest'
]);

function pickModel() {
  const envModel = (process.env.GEMINI_MODEL || '').trim();
  if (VALID_MODELS.has(envModel)) return envModel;
  return 'gemini-1.5-flash';
}

async function buildContext() {
  const supabase = getSupabase('anon');

  const [jobs, resources, events, trainings] = await Promise.all([
    supabase.from('jobs').select('title,company,apply_link').order('created_at', { ascending: false }).limit(10),
    supabase.from('resources').select('name,provider,website').order('name', { ascending: true }).limit(10),
    supabase.from('events').select('name,event_date').order('event_date', { ascending: true }).limit(10),
    supabase.from('trainings').select('name,description,next_start_date').order('next_start_date', { ascending: true }).limit(10)
  ]);

  const lines = [];

  if (!jobs.error && Array.isArray(jobs.data) && jobs.data.length) {
    lines.push('FEATURED JOBS:');
    jobs.data.forEach(j => lines.push(`- ${j.title || '—'} @ ${j.company || ''} ${j.apply_link ? `(apply: ${j.apply_link})` : ''}`));
  }
  if (!resources.error && Array.isArray(resources.data) && resources.data.length) {
    lines.push('\nRESOURCES:');
    resources.data.forEach(r => lines.push(`- ${r.name || ''} (${r.provider || ''}) ${r.website ? r.website : ''}`));
  }
  if (!events.error && Array.isArray(events.data) && events.data.length) {
    lines.push('\nEVENTS:');
    events.data.forEach(e => lines.push(`- ${e.name || ''} ${e.event_date || ''}`));
  }
  if (!trainings.error && Array.isArray(trainings.data) && trainings.data.length) {
    lines.push('\nTRAININGS:');
    trainings.data.forEach(t => lines.push(`- ${t.name || ''} ${t.next_start_date || ''}`));
  }

  return lines.join('\n');
}

export default async function handler(req) {
  try {
    if (req.method !== 'POST') return fail(405, 'Method not allowed');

    const { prompt, systemPrompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') return fail(400, 'Missing prompt');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return fail(500, 'Missing GEMINI_API_KEY');

    const modelName = pickModel();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const context = await buildContext();

    const composed = [
      systemPrompt ? `SYSTEM:\n${systemPrompt}` : '',
      context ? `CONTEXT (live data):\n${context}` : '',
      `USER:\n${prompt}`
    ].filter(Boolean).join('\n\n---\n\n');

    const result = await model.generateContent(composed);
    const text = result?.response?.text?.() || 'Sorry, no answer.';
    return ok({ reply: text });
  } catch (err) {
    return fail(502, { reply: 'Upstream model error', detail: String(err?.message || err) });
  }
}
