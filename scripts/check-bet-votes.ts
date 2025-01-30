import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

async function checkBetVotes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    // Get raw data directly from MongoDB
    const db = mongoose.connection.db;
    const betsCollection = db.collection('bets');
    
    const bets = await betsCollection.find({
      resolved: false,
      $where: "return Object.keys(this.votes || {}).length > 0"
    }).toArray();

    console.log('Raw bets from MongoDB:', bets.length);
    bets.forEach(bet => {
      console.log('\n=== Bet ===');
      console.log('ID:', bet._id);
      console.log('Title:', bet.title);
      console.log('Raw votes data:', bet.votes);
      console.log('Type of votes:', typeof bet.votes);
      console.log('Is Map?', bet.votes instanceof Map);
      console.log('Keys:', Object.keys(bet.votes || {}));
      console.log('============\n');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkBetVotes();
