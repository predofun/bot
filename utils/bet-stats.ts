import mongoose from 'mongoose';
import Bet from '../models/bet.schema';
import UserWallet from '../models/user-wallet.schema';

interface BetStats {
  totalBets: number;
  totalUsers: number;
  singleParticipantBets: number;
  multiParticipantBets: number;
  moneyStakedBets: number;
  moneyStakePercentage: number;
  currentActiveUsers: number;
}

export async function getBetStats(): Promise<BetStats> {
  try {
    // Get total number of bets
    const totalBets = await Bet.countDocuments();
    
    // Get unique users who have participated in bets
    const uniqueUsers = await Bet.distinct('participants');
    const totalUsers = uniqueUsers.length;
    
    // Get bets with exactly 1 participant
    const singleParticipantBets = await Bet.countDocuments({
      $expr: { $eq: [{ $size: '$participants' }, 1] }
    });
    
    // Get bets with 2 or more participants
    const multiParticipantBets = await Bet.countDocuments({
      $expr: { $gte: [{ $size: '$participants' }, 2] }
    });
    
    // Get bets where minAmount > 0 (money was staked)
    const moneyStakedBets = singleParticipantBets + multiParticipantBets;


    
    // Get current active users (users in unresolved bets)
    const currentActiveUsers = await Bet.distinct('participants', {
      resolved: false
    }).then(users => users.length);
    
    // Calculate percentage of bets with money staked
    const moneyStakePercentage = totalBets > 0 
      ? (moneyStakedBets / totalBets) * 100 
      : 0;

    return {
      totalBets,
      totalUsers,
      singleParticipantBets,
      multiParticipantBets,
      moneyStakedBets,
      moneyStakePercentage,
      currentActiveUsers
    };
  } catch (error) {
    console.error('Error getting bet stats:', error);
    throw error;
  }
}
