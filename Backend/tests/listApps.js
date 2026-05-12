import { getDb } from '../db.js';
(async () => {
  const db = await getDb();
  const apps = await db.collection('applications').find({}).limit(20).toArray();
  console.log('Found', apps.length, 'applications');
  apps.forEach((a, i) => {
    console.log(i+1, 'id=', String(a._id), 'studentEmail=', a.studentEmail, 'status=', a.status);
  });
  process.exit(0);
})();