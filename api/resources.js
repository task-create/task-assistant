// /api/resources.js
import { getServiceClient } from './supabase';
export const config = { runtime: 'edge' };

export default async function handler() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('resources')
      .select('id,name,category,description,website,phone_number')
      .order('name', { ascending: true });

    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}
