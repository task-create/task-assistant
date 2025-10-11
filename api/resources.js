// /api/resources.js
import { getSupabase, ok, fail } from './supabase.js';

export default async function handler(req) {
  try {
    if (req.method !== 'GET') return fail(405, 'Method not allowed');

    const supabase = getSupabase('anon');

    const { data, error } = await supabase
      .from('resources')
      .select('id,name,provider,website,description,category,updated_at')
      .order('name', { ascending: true });

    if (error) return fail(500, error.message);

    return ok(data || []);
  } catch (e) {
    return fail(500, e.message || 'Unexpected server error.');
  }
}
