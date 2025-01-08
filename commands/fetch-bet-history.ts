import { createWallet } from '../utils/wallet-infra';
import UserWallet from '../models/user-wallet.schema';
import Bet from '../models/bet.schema';
import { DateTime } from 'luxon';

export default async function fetchBetHistory(ctx: any) {
  if (ctx.chat.type !== 'private') return;

  const username = ctx.from?.username;
  if (!username) {
    ctx.reply(
      `🚫 Prediction Archives Locked! 🔒\n\n` +
        `Oops! You need a Telegram username to access your prediction history. \n` +
        `Set up your username and unlock your legendary predictions! 🏆`
    );
    return;
  }

  try {
    let wallet = await UserWallet.findOne({ username });
    const betHistory = await Bet.find({ participants: wallet._id }).lean()

    if (betHistory.length > 0) {
      const betHistoryString = betHistory
        .map((bet) => {
          return (
            `🎲 *Bet*\n` +
            `└ ID: \`${bet.betId}\`\n` +
            `📌 *Title*: ${bet.title}\n` +
            `🎯 *Options*: ${bet.options.join(' | ')}\n` +
            `${
              wallet._id && bet.votes && bet.votes[wallet._id as string] !== undefined
                ? `🤝 *Your Vote*: ${`${bet.votes[wallet._id as string]}`}\n`
                : ''
            }` +
            `👥 *Participants*: ${bet.participants.length}\n` +
            `💰 *Pot*: ${bet.minAmount * bet.participants.length} USDC\n` +
            `💰 *Stake*: ${bet.minAmount} USDC\n` +
            `${
              new Date().getTime() < bet.endTime.getTime() ? '*Ends*' : '*Ended*'
            }: ${DateTime.fromJSDate(bet.endTime).toLocaleString(DateTime.DATETIME_FULL)}\n` +
            `───────────────\n`
          );
        })
        .join('');

      ctx.reply(
        `🏆 *Prediction Hall of Fame* 🌟\n\n` +
          `Welcome, ${username}, prediction master! 🎉\n\n` +
          `📊 *Your Legendary Betting Journey*\n\n` +
          `${betHistoryString}\n` +
          `🔮 *Total Bets*: ${betHistory.length}\n\n` +
          `💡 Keep challenging fate, and may your predictions be ever in your favor! 🎲`,
        { parse_mode: 'Markdown' }
      );
    } else {
      ctx.reply(
        `🕳️ *Empty Prediction Archives* 📜\n\n` +
          `Looks like you haven't started your prediction journey yet! \n` +
          `Create your first bet and write your legend! 🚀\n\n` +
          `💡 Use /bet to start predicting and make history!`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Error fetching bet history:', error);
    ctx.reply(
      `🚫 Error Fetching Prediction History! 🔴\n` +
        `There was a technical issue fetching your prediction history. \n` +
        `Please try again later, or contact the bot developers if the issue persists.`
    );
  }
}
