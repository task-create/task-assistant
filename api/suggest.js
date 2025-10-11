// /api/suggest.js
import { getSupabase, ok, fail } from './supabase.js';

const FALLBACK = [
  { text: 'Help me with my resume' },
  { text: 'What jobs are open?' },
  { text: 'Any free training programs?' }
];

export default async function handler(req) {
  try {
    if (req.method !== 'GET') return fail(405, 'Method not allowed');

    const supabase = getSupabase('anon');
    const { data, error } = await supabase
      .from('suggestions') // create if you want; else we fallback
      .select('id,text')
      .order('id', { ascending: true })
      .limit(12);

    if (error) return ok(FALLBACK);
    if (!Array.isArray(data) || data.length === 0) return ok(FALLBACK);

    return ok(data.map(x => ({ text: x.text })));
  } catch {
    return ok(FALLBACK);
  }
}
