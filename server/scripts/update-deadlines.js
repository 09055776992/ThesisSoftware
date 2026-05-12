// MongoDB script to update all scholarship deadlines to December 31, 2026
// Run with: node update-deadlines.js

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'scholarship-portal';

async function updateDeadlines() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    const scholarships = db.collection('scholarships');
    
    // Count current scholarships
    const count = await scholarships.countDocuments();
    console.log(`Found ${count} scholarships in database`);
    
    // Find scholarships with expired deadlines
    const expiredCount = await scholarships.countDocuments({
      deadline: { $lt: new Date() }
    });
    console.log(`Found ${expiredCount} scholarships with expired deadlines`);
    
    // Update all scholarships to December 31, 2026
    const newDeadline = new Date('2026-12-31T23:59:59.000Z');
    
    const result = await scholarships.updateMany(
      {}, // All scholarships
      { $set: { deadline: newDeadline } }
    );
    
    console.log('\n=== UPDATE RESULTS ===');
    console.log(`Total scholarships: ${count}`);
    console.log(`Updated: ${result.modifiedCount}`);
    console.log(`New deadline set to: ${newDeadline.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`);
    
    // Verify update
    const sample = await scholarships.findOne();
    console.log('\n=== SAMPLE VERIFICATION ===');
    console.log('Sample scholarship:');
    console.log(`  Name: ${sample.name}`);
    console.log(`  Deadline: ${sample.deadline}`);
    console.log(`  Status: ${sample.status}`);
    
    // Check if any still have old dates
    const oldDeadlines = await scholarships.countDocuments({
      deadline: { $lt: new Date('2025-01-01') }
    });
    
    if (oldDeadlines === 0) {
      console.log('\n✅ SUCCESS: All scholarships now have future deadlines!');
    } else {
      console.log(`\n⚠️ WARNING: ${oldDeadlines} scholarships still have old deadlines`);
    }
    
  } catch (error) {
    console.error('Error updating deadlines:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

updateDeadlines();
