import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';
(async () => {
  const id = '6a027a84fa004b2491673ad3';
  const db = await getDb();
  const query = ObjectId.isValid(id) ? { $or: [{ _id: new ObjectId(id) }, { _id: id }] } : { _id: id };
  console.log('Running findOne for id', id);
  const one = await db.collection('applications').findOne(query);
  console.log('findOne result:', one ? String(one._id) : null);
  console.log('Running findOneAndUpdate for id', id);
  const res = await db.collection('applications').findOneAndUpdate(query, { $set: { testFlag: true } }, { returnDocument: 'after' });
  console.log('findOneAndUpdate result:', res?.value ? String(res.value._id) : null, 'raw:', res);
  // Cleanup
  await db.collection('applications').updateOne(query, { $unset: { testFlag: '' } });
  process.exit(0);
})();