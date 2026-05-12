import dotenv from 'dotenv';
dotenv.config();
const fetch = globalThis.fetch || (await import('node-fetch').then(m=>m.default));
const BASE = 'http://localhost:5000/api';

async function call(method, path, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch(e) { json = text; }
  console.log(`\n[${method}] ${path} -> ${res.status}`);
  console.log('Request body:', body);
  console.log('Response:', json);
  return { status: res.status, data: json };
}

(async () => {
  const signin = await call('POST', '/auth/admin/signin', { email: 'admin@qcsp.gov.ph', password: 'admin123' });
  if (signin.status !== 200) return;
  const token = signin.data?.token;
  const appId = process.argv[2] || '6a02a12c8620c0dfe24d6a06';
  const now = new Date();
  const fut = new Date(now.getTime() + 7*24*60*60*1000);
  const date = fut.toISOString().split('T')[0];
  const time = '14:30';
  await call('PATCH', `/admin/applications/${appId}/schedule-screening`, { scheduledDate: date, scheduledTime: time, venue: 'Manual Test Venue', notes: 'Manual test' }, token);
  await call('GET', `/admin/applications/${appId}/screening`, null, token);
})();