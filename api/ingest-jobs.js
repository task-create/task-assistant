// /api/ingest-jobs.js
import { getSupabase, ok, fail } from './supabase.js';

export default async function handler(req) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return fail(405, 'Method not allowed');
    }

    // Requires service role to bypass RLS for writes
    const supabase = getSupabase('service');

    // Example: upsert a single test job. Replace with your real feed logic.
    const sample = {
      title: 'Warehouse Associate',
      company: 'Acme Logistics',
      location: 'Trenton, NJ',
      apply_link: 'https://example.com/apply',
    };

    const { error } = await supabase
      .from('jobs')
      .upsert(sample, { onConflict: 'title,company' });

    if (error) return fail(500, error.message);

    return ok({ inserted: 1 });
  } catch (e) {
    return fail(500, e.message || 'Ingest failed.');
  }
}
