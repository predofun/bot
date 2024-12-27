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
  let newWallet = await createWallet();
  let wallet = await UserWallet.findOne({ username });
  const betHistory = await Bet.find({ participants: wallet._id });

  if (betHistory.length > 0) {
    const betHistoryString = betHistory
      .map((bet) => {
        return `Bet ID: ${bet.betId}\nTitle: ${bet.title}\nOptions: ${bet.options.join(
          ', '
        )}\nMin Amount: ${bet.minAmount}\nEnd Time: ${bet.endTime}\n\n`;
      })
      .join('');
    ctx.reply(`Your bet history:\n\n${betHistoryString}`);
  } else {
    ctx.reply('You have not joined any bets yet.');
  }
}
