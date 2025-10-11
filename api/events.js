// /api/events.js
import { getSupabase, ok, fail } from './supabase.js';

export default async function handler(req) {
  try {
    if (req.method !== 'GET') return fail(405, 'Method not allowed');

    const supabase = getSupabase('anon');

    const { data, error } = await supabase
      .from('events')
      .select('id,name,event_date,location,description,updated_at')
      .order('event_date', { ascending: true })
      .limit(50);

    if (error) return fail(500, error.message);

    return ok(data || []);
  } catch (e) {
    return fail(500, e.message || 'Unexpected server error.');
  }
}
