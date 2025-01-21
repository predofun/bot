import { Context } from 'telegraf';
import { CallbackQuery } from 'telegraf/types';
import Poll from '../models/poll.schema';
import Bet from '../models/bet.schema';
import { ObjectId } from 'mongodb';

export async function handleBetResolutionCallback(ctx: Context) {
  try {
    const callbackQuery = ctx.callbackQuery as CallbackQuery.DataQuery;
    if (!callbackQuery.data) return;

    const userId = callbackQuery.from.id.toString();

    const [action, betId, optionStr] = callbackQuery.data.split(':');

    const poll = await Poll.findOne({
      betId: new ObjectId(betId),
      resolved: false
    });

    if (!poll) {
      await ctx.answerCbQuery('This poll has expired or does not exist.');
      return;
    }

    const bet = await Bet.findById(betId);
    if (!bet) {
      await ctx.answerCbQuery('Bet not found.');
      return;
    }

    // Initialize votes map if it doesn't exist
    if (!poll.votes) {
      poll.votes = new Map();
    }

    switch (action) {
      case 'accept_resolution':
        // Vote 1 for accept
        poll.votes.set(userId, 1);
        poll.aiOption = parseInt(optionStr);
        await ctx.answerCbQuery('You voted to accept the AI resolution.');
        break;

      case 'reject_resolution':
        // Vote 0 for reject
        poll.votes.set(userId, 0);
        await ctx.answerCbQuery('You voted to reject the AI resolution.');
        break;

      case 'vote':
        const option = parseInt(optionStr);
        if (isNaN(option) || option < 0 || option >= bet.options.length) {
          await ctx.answerCbQuery('Invalid option.');
          return;
        }
        poll.votes.set(userId, option);
        await ctx.answerCbQuery(`You voted for: ${bet.options[option]}`);
        break;

      default:
        await ctx.answerCbQuery('Invalid action.');
        return;
    }

    await poll.save();

    // Update the message to show current votes
    const totalVotes = poll.votes.size;
    let messageText = '';

    if (action === 'vote') {
      // For manual resolution poll
      const voteCounts = new Map<number, number>();
      for (const vote of poll.votes.values()) {
        voteCounts.set(vote, (voteCounts.get(vote) || 0) + 1);
      }

      messageText = `🗳️ Poll for "${bet.title}"\n\nCurrent Results:\n`;
      bet.options.forEach((option, index) => {
        const votes = voteCounts.get(index) || 0;
        const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
        messageText += `${option}: ${votes} votes (${percentage.toFixed(1)}%)\n`;
      });
      messageText += `\nTotal Votes: ${totalVotes}`;

    } else {
      // For AI resolution acceptance poll
      const accepts = Array.from(poll.votes.values()).filter(v => v === 1).length;
      const rejects = totalVotes - accepts;
      const acceptPercentage = totalVotes > 0 ? (accepts / totalVotes) * 100 : 0;
      const rejectPercentage = totalVotes > 0 ? (rejects / totalVotes) * 100 : 0;

      messageText = `🤖 AI Resolution for "${bet.title}"\n\n` +
        `AI's Choice: ${bet.options[poll.aiOption!]}\n\n` +
        `Current Results:\n` +
        `✅ Accept: ${accepts} votes (${acceptPercentage.toFixed(1)}%)\n` +
        `❌ Reject: ${rejects} votes (${rejectPercentage.toFixed(1)}%)\n\n` +
        `Total Votes: ${totalVotes}`;
    }

    // Keep the original inline keyboard if it exists
    const options: any = {};
    if (callbackQuery.message && 'reply_markup' in callbackQuery.message) {
      options.reply_markup = callbackQuery.message.reply_markup;
    }
    await ctx.editMessageText(messageText, options);

  } catch (error) {
    console.error('Error handling bet resolution callback:', error);
    await ctx.answerCbQuery('An error occurred while processing your vote.');
  }
}
