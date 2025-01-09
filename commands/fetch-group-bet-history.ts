import { DateTime } from 'luxon';
import Bet from '../models/bet.schema';

export default async function getOngoingBets(ctx: any) {
  try {
    // Ensure this is a group chat
    if (ctx.chat.type === 'private') {
      ctx.reply(
        `🚫 Group Bets Only! 🏟️\n\n` +
          `This command can only be used in group chats. Head to a group to see ongoing bets!`
      );
      return;
    }

    // Find ongoing bets for this group that haven't ended
    const ongoingBets = await Bet.find({
      groupId: ctx.chat.id,
      endTime: { $gt: new Date() }, // Bets with end time in the future
      resolved: { $ne: true } // Not yet resolved
    }).sort({ endTime: 1 }); // Sort by earliest ending first

    if (ongoingBets.length === 0) {
      ctx.reply(
        `🏜️ No Active Bets! 🕳️\n\n` +
          `Looks like there are no ongoing bets in this group. ` +
          `Tag @predofun_bot or use the /bet command to start a new betting challenge!`
      );
      return;
    }

    // Construct a message with ongoing bets
    const betsMessage = ongoingBets
      .map((bet, index) => {
        const endTime = DateTime.fromJSDate(bet.endTime);
        return (
          `${index + 1}. 🎲 *${bet.title}*\n` +
          `   └ ID: \`${bet.betId}\`\n` +
          `   └ Options: ${bet.options.join(' | ')}\n` +
          `   └ Minimum Stake: ${bet.minAmount} USDC\n` +
          `   └ Ends: ${endTime.toLocaleString(DateTime.DATETIME_FULL)}\n` +
          `   └ [Bet Link](https://t.me/predofun_bot?start=${bet.betId})\n` +
          `   └ Votes: ${bet.votes ? Object.keys(bet.votes).length : 0}\n` +
          `   └ Participants: ${bet.participants?.length || 0}\n\n`
        );
      })
      .join('');

    ctx.reply(
      `🏆 *${ctx.chat.title} Ongoing Bets* 🎯\n\n` +
        betsMessage +
        `💡 Use /join <bet-id> to participate in these exciting bets!`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in getOngoingBets:', error);
    ctx.reply(
      `❌ An unexpected error occurred while fetching ongoing bets. Please try again later.`
    );
  }
}
