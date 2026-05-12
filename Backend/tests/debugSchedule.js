const fetch = globalThis.fetch || require('node-fetch');
const BASE = 'http://localhost:5000/api';

async function api(method, path, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.text();
  console.log(`\n[${method}] ${path}`);
  console.log('Status:', res.status);
  console.log('Response:', data);
  try { return { status: res.status, json: JSON.parse(data) }; } catch (e) { return { status: res.status, text: data }; }
}

(async () => {
  try {
    const signin = await api('POST','/auth/admin/signin',{ email: 'admin@qcsp.gov.ph', password: 'admin123' });
    if (signin.status !== 200) return;
    const token = signin.json?.token || signin.text || signin.json;
    const apps = await api('GET','/admin/applications',null,token);
    const appsData = Array.isArray(apps.json) ? apps.json : (apps.json?.data || apps.json);
    console.log('\nApplications count:', appsData.length);
    const eligible = appsData.find(a => a.eligibilityCheck?.passed === true);
    if (!eligible) { console.log('No eligible app found'); return; }
    console.log('Using application id:', eligible._id || eligible.id);
    const id = (eligible._id || eligible.id).toString();
    const now = new Date();
    const future = new Date(now.getTime() + 7*24*60*60*1000);
    const dateString = future.toISOString().split('T')[0];
    const timeString = '14:30';
    await api('PATCH',`/admin/applications/${id}/schedule-screening`,{ scheduledDate: dateString, scheduledTime: timeString, venue: 'QC Conference Room', notes: 'Bring ID' }, token);
  } catch (err) { console.error(err); }
})();