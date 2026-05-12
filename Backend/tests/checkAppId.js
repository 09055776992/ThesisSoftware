import { getDb } from '../db.js';

const id = process.argv[2];
(async () => {
  if (!id) { console.error('Usage: node checkAppId.js <id>'); process.exit(1); }
  const db = await getDb();
  const { ObjectId } = await import('mongodb');
  const doc = await db.collection('applications').findOne({});
  console.log('Sample application _id raw:', doc._id);
  console.log('Type of _id:', typeof doc._id);
  console.log('Is ObjectId:', doc._id instanceof ObjectId);
  console.log('toString:', String(doc._id));
  // Try fetching by ObjectId and by string
  const byObj = await db.collection('applications').findOne({ _id: new ObjectId(id) }).catch(e=>({error:e.message}));
  const byStr = await db.collection('applications').findOne({ _id: id }).catch(e=>({error:e.message}));
  console.log('\nLookup by ObjectId result:', byObj ? (byObj._id ? String(byObj._id) : byObj) : 'null');
  console.log('Lookup by string result:', byStr ? (byStr._id ? String(byStr._id) : byStr) : 'null');
  process.exit(0);
})();