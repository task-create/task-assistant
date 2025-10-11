// api/resources.js
export const config = { runtime: 'nodejs' };
import { getSupabase, ok, err } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return ok(res, []);
  if (req.method !== 'GET') return err(res, 405, 'Method Not Allowed');

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('resources')
      .select('id,name,provider,description,website,category')
      .order('name', { ascending: true });

    if (error) return err(res, 500, error);
    return ok(res, data || []);
  } catch (e) {
    return err(res, 500, e);
  }
}
