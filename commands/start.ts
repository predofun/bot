import { createWallet } from '../utils/wallet-infra';
import UserWallet from '../models/user-wallet.schema';

export default async function start(ctx: any) {
  if (ctx.chat.type !== 'private') return;

  const username = ctx.from?.username;
  if (!username) {
    ctx.reply(
      `🚫 Betting Portal Blocked! 🤖\n\n` +
        `Oops! You need a Telegram username to enter the betting realm. \n` +
        `Set up your username and prepare to challenge fate! 🎲`
    );
    return;
  }

  const existingWallet = await UserWallet.findOne({ username });
  if (existingWallet) {
    ctx.reply(
      `🙅‍♂️ You've already started your betting journey! 🚀\n` +
        `Your wallet is ready, and your fate is waiting. \n` +
        `Use /bet to create your first betting challenge!`
    );
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

  ctx.replyWithPhoto(
    `https://res.cloudinary.com/dbuaprzc0/image/upload/v1735991233/a2ln2zbdksmibvyux53n.gif`,
    {
      caption:
        `🎉 Welcome to the Betting Arena! 🚀\n\n` +
        `Your betting journey begins now, ${username}! 🌟\n\n` +
        `🔑 Wallet Created:\n` +
        `└ Address: \`${wallet.address}\`\n\n` +
        `💰 Starter Balance: ${newWallet.balance} USDC\n` +
        `Your first step into the world of social betting excitement! 🎲\n\n` +
        `💡 Pro Tip: Use /bet to create your first betting challenge!`
    }
  );
}
