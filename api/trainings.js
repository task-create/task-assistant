// /api/trainings.js
import { getServiceClient } from './supabase';
export const config = { runtime: 'edge' };

export default async function handler() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('trainings')
      .select('id,name,description,schedule,next_start_date,app_window_start,app_window_end,requirements,signup_link,is_active,start_date_note')
      .eq('is_active', true)
      .order('next_start_date', { ascending: true })
      .limit(25);

    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}
