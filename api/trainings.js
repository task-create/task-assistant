function json(res, status, body) {
res.statusCode = status;
res.setHeader('Content-Type', 'application/json');
res.setHeader('Access-Control-Allow-Origin', '*');
if (res.req.method === 'OPTIONS') return res.end();
res.end(JSON.stringify(body));
}


async function getClient() {
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;
const { createClient } = await import('@supabase/supabase-js');
return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}


export default async function handler(req, res) {
if (req.method === 'OPTIONS') return json(res, 204, {});


try {
const supabase = await getClient();
if (!supabase) return json(res, 200, { ok: false, error: 'Supabase env missing', data: [] });


const { data, error } = await supabase
.from('trainings') // <-- update if your table name differs
.select('*')
.order('next_start_date', { ascending: true, nullsFirst: false })
.limit(50);


if (error) return json(res, 200, { ok: false, error: error.message, data: [] });
return json(res, 200, { ok: true, data });
} catch (e) {
return json(res, 200, { ok: false, error: e?.message || 'unknown', data: [] });
}
}
