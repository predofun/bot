import UserWallet from '../models/user-wallet.schema';
import { getWalletBalance } from '../utils/wallet-infra';

export default async function getBalance(ctx) {
  try {
    if (ctx.chat.type !== 'private') return;

    const username = ctx.from?.username;
    if (!username) {
      ctx.reply(
        `🚫 Bet Wallet Blocked! 🤖\n\n` +
          `Oops! You need a Telegram username to access your bot funds. \n` +
          `Set up your username and get ready to bet! 🎲`
      );
      return;
    }

    const wallet = await UserWallet.findOne({ username });
    if (!wallet) {
      ctx.reply(
        `💼 Wallet Missing in Action! 🕳️\n\n` +
          `Looks like you haven't started your bet journey. \n` +
          `Use /start to create your bet powerhouse! 🚀`
      );
      return;
    }
    const balance = Number(await getWalletBalance(wallet.address));

    // Fun balance messages with different tones based on balance
    const balanceMessages = [
      balance === 0
        ? `🏜️ Wallet Tumbleweeds! Looks like your bet funds are on vacation. Time to /fund! 💸`
        : balance < 10
        ? `🌱 Small but mighty! Your bet seed is growing. Keep betting! 💪`
        : balance < 50
        ? `🚀 Bet Fuel Building Up! You're ready for some serious wagering! 🎲`
        : `🏆 Bet Champion Wallet Alert! 💰 You're armed and dangerous! 🔥`
    ];
    ctx.reply(
      `💼 *Bet Wallet Status* 🎯\n\n` +
        `🔑 Address: \`${wallet.address}\`\n` +
        `💰 Balance: *${balance} USDC*\n\n` +
        `${balanceMessages[0]}`,
      {
        parse_mode: 'Markdown'
      }
    );
  } catch (error) {
    console.log(error);
  }
}
