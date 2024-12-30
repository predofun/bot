import UserWallet from '../models/user-wallet.schema';
import { getWalletBalance } from '../utils/wallet-infra';

export default async function getBalance(ctx) {
  try {
    if (ctx.chat.type !== 'private') return;

    const username = ctx.from?.username;
    if (!username) {
      ctx.reply('Please set a username in Telegram to use this bot.');
      return;
    }

    const wallet = await UserWallet.findOne({ username });
    if (!wallet) {
      ctx.reply("You don't have a wallet yet. Use /start to create one.");
      return;
    }

    const balance = await getWalletBalance(wallet.address);
    ctx.reply(`Your wallet address is: ${wallet.address}\n` + `Your balance is: *${balance} USDC*`);
  } catch (error) {
    console.log(error);
    console.log('ok');
  }
}
