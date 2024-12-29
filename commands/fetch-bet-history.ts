import { createWallet } from '../utils/wallet-infra';
import UserWallet from '../models/user-wallet.schema';
import Bet from '../models/bet.schema';

export default async function getHistory(ctx: any) {
  if (ctx.chat.type !== 'private') return;

  const username = ctx.from?.username;
  if (!username) {
    ctx.reply('Please set a username in Telegram to use this bot.');
    return;
  }
  let wallet = await UserWallet.findOne({ username });
  const betHistory = await Bet.find({ participants: wallet._id });

  if (betHistory.length > 0) {
    const betHistoryString = betHistory
      .map((bet) => {
        return (
          `🎲 *Bet Details*\n` +
          `└ ID: \`${bet.betId}\`\n` +
          `📌 *Title*: ${bet.title}\n` +
          `🎯 *Options*: ${bet.options.join(' | ')}\n` +
          `💰 *Min Amount*: ${bet.minAmount} USDC\n` +
          `⏰ *End Time*: ${bet.endTime.toLocaleString()}\n` +
          `───────────────\n`
        );
      })
      .join('');

    // Format the reply message
    ctx.reply(
      `🎮 *Welcome ${username}!*\n\n` +
        `📊 *Your Betting History*\n\n` +
        `${betHistoryString}\n` +
        `🍀 _Keep betting, and may the odds be ever in your favor!_`,
      { parse_mode: 'Markdown' }
    );
  } else {
    ctx.reply(
      `❌ *No Betting History*\n\n` +
        `_You haven't joined any bets yet._\n` +
        `Start betting now to build your history!`,
      { parse_mode: 'Markdown' }
    );
  }
}
