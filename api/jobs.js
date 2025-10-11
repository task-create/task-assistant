// /api/jobs.js
import { getSupabase, ok, fail } from './supabase.js';

export default async function handler(req) {
  try {
    if (req.method !== 'GET') return fail(405, 'Method not allowed');

    const supabase = getSupabase('anon');

    // Optional query string ?q=term to filter title/company
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();

    let query = supabase
      .from('jobs')
      .select('id,title,company,apply_link,location,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (q) {
      // If you have pg_trgm, you can use ilike; otherwise do a simple ilike
      query = query.or(`title.ilike.%${q}%,company.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) return fail(500, error.message);

    return ok(data || []);
  } catch (e) {
    return fail(500, e.message || 'Unexpected server error.');
  }
}
