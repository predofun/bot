import { createWallet } from '../utils/wallet-infra';
import UserWallet from '../models/user-wallet.schema';
export default async function start(ctx: any) {
  if (ctx.chat.type !== 'private') return;

  const username = ctx.from?.username;
  if (!username) {
    ctx.reply('Please set a username in Telegram to use this bot.');
    return;
  }
  let newWallet = await createWallet();
  let wallet = await UserWallet.findOneAndUpdate(
    { username },
    {
      username,
      address: newWallet.address,
      privateKey: newWallet.privateKey
    },
    { upsert: true, new: true }
  );

  ctx.reply(
    `Your wallet address is: ${
      wallet.address
    }.\nYou have been rewarded with ${newWallet.balance.toFixed(
      2
    )} USDC to start with your first bet.`
  );
}
