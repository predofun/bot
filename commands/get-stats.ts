import { Context } from 'telegraf';
import { getBetStats } from '../utils/bet-stats';

export async function getStats(ctx: Context) {
  try {
    const stats = await getBetStats();
    
    const message = `📊 *Betting Statistics*\n\n` +
      `Total Bets: ${stats.totalBets}\n` +
      `Total Users: ${stats.totalUsers}\n` +
      `Current Active Users: ${stats.currentActiveUsers}\n\n` +
      `*Participation Stats:*\n` +
      `Single Participant Bets: ${stats.singleParticipantBets}\n` +
      `Multi-participant Bets: ${stats.multiParticipantBets}\n\n` +
      `*Money Stats:*\n` +
      `Bets with Money Staked: ${stats.moneyStakedBets}\n` +
      `Money Stake Percentage: ${stats.moneyStakePercentage.toFixed(2)}%`;
    
    await ctx.replyWithMarkdown(message);
  } catch (error) {
    console.error('Error in get-stats command:', error);
    await ctx.reply('Sorry, there was an error getting the betting statistics.');
  }
}
