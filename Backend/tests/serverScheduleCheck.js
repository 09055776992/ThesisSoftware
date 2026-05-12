import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';

const id = process.argv[2];
(async () => {
  const db = await getDb();
  console.log('Checking id:', id);
  const query1 = { _id: new ObjectId(id) };
  const query2 = { _id: id };
  const query3 = { $or: [query1, query2] };
  console.log('Query3:', JSON.stringify(query3));
  const found1 = await db.collection('applications').findOne(query1).catch(e=>({error:e.message}));
  const found2 = await db.collection('applications').findOne(query2).catch(e=>({error:e.message}));
  const found3 = await db.collection('applications').findOne(query3).catch(e=>({error:e.message}));
  console.log('found1:', found1 ? (found1._id ? String(found1._id) : found1) : 'null');
  console.log('found2:', found2 ? (found2._id ? String(found2._id) : found2) : 'null');
  console.log('found3:', found3 ? (found3._id ? String(found3._id) : found3) : 'null');
  process.exit(0);
})();