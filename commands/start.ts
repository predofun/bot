import { createWallet } from '../utils/wallet-infra';
import UserWallet from '../models/user-wallet.schema';

export default async function start(ctx: any) {
  if (ctx.chat.type !== 'private') return;

  const username = ctx.from?.username;
  if (!username) {
    ctx.reply(
      `🚫 Prediction Portal Blocked! 🤖\n\n` +
      `Oops! You need a Telegram username to enter the prediction realm. \n` +
      `Set up your username and prepare to challenge fate! 🎲`
    );
    return;
  }

  const existingWallet = await UserWallet.findOne({ username });
  if (existingWallet) {
    ctx.reply(
      `🙅‍♂️ You've already started your prediction journey! 🚀\n\n` +
      `Your wallet is ready, and your fate is waiting. \n` +
      `Use /bet to create your first prediction challenge!`
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

  ctx.reply(
    `🎉 Welcome to the Prediction Arena! 🚀\n\n` +
    `Your prediction journey begins now, ${username}! 🌟\n\n` +
    `🔑 Wallet Created:\n` +
    `└ Address: \`${wallet.address}\`\n\n` +
    `💰 Starter Bonus: ${newWallet.balance} USDC\n` +
    `Your first step into the world of predictive excitement! 🎲\n\n` +
    `💡 Pro Tip: Use /bet to create your first prediction challenge!`
  );
}
