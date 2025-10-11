// /api/jobs.js
import { getServiceClient } from './supabase';
export const config = { runtime: 'edge' };

export default async function handler() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('jobs')
      .select('id,title,company,location,description,apply_link,is_active,expiration_date,created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}
