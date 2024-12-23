import { createWallet } from '../utils/crossmint';
import UserWallet from '../models/user-wallet.schema';
export default async function start(ctx: any) {
  if (ctx.chat.type !== 'private') return;

  const username = ctx.from?.username;
  if (!username) {
    ctx.reply('Please set a username in Telegram to use this bot.');
    return;
  }

  let wallet = await UserWallet.findOne({ username });
  if (!wallet) {
    const newWallet = await createWallet(username);
    console.log(newWallet);
    wallet = new UserWallet({ username, address: newWallet.address });
    await wallet.save();
  }

  ctx.reply(
    `Your wallet address is: ${wallet.address}\nSend USDC to this address to participate in bets.`
  );
}
