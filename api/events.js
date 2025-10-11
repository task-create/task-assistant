// /api/events.js
import { getServiceClient } from './supabase';
export const config = { runtime: 'edge' };

export default async function handler() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('events')
      .select('id,name,description,event_date,schedule,signup_link,is_active,requirements')
      .eq('is_active', true)
      .order('event_date', { ascending: true })
      .limit(50);

    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}
