import { Connection, PublicKey } from '@solana/web3.js';
import UserWallet from '../models/user-wallet.schema';
import Bet from '../models/bet.schema';
import { env } from '../config/environment';

const solanaConnection = new Connection(env.HELIUS_RPC_URL!);

export default async function joinBet(ctx: any) {
  if (ctx.chat.type === 'private') return;

  const username = ctx.from?.username;
  if (!username) {
    ctx.reply(
      `🚫 Bet Blocked! 🤖\n\n` +
        `Oops! You need a Telegram username to join the bet arena. \n` +
        `Set up your username and come back to challenge fate! 🎲`
    );
    return;
  }

  const betId = ctx.message.text.split('/join')[1].trim();
  const bet = await Bet.findOne({ betId });
  if (!bet) {
    ctx.reply(
      `🕵️ Bet Detective Says: Invalid Bet! 🚨\n\n` +
        `The bet ID you entered seems to have vanished into the bet void. \n` +
        `Double-check your bet ID and try again! 🔍`
    );
    return;
  }

  const wallet = await UserWallet.findOne({ username });
  if (!wallet) {
    ctx.reply(
      `💼 Wallet Missing in Action! 🚫\n\n` +
        `Start a private chat with the bot to create your bet wallet first. \n` +
        `Your bet journey begins with a single wallet! 🌟`
    );
    return;
  }

  const balance = await solanaConnection.getBalance(new PublicKey(wallet.address));
  if (balance < bet.minAmount) {
    ctx.reply(
      `💸 Insufficient Funds Alert! 🚨\n\n` +
        `Your wallet is looking a bit light for this bet. \n` +
        `Minimum stake: ${bet.minAmount} USDC\n` +
        `Current balance: ${balance} USDC\n` +
        `Top up and come back to join the bet party! 🎉`
    );
    return;
  }

  // Deduct bet amount and add user to participants
  //   await crossmint.transfer({
  //     amount: bet.minAmount,
  //     from: wallet.address,
  //     to: process.env.BOT_WALLET_ADDRESS!,
  //     tokenId: 'usdc'
  //   });

  bet.participants.push(username);
  await bet.save();

  ctx.reply(
    `🤝 New Bettor Joins the Bet! 🎯\n\n` +
      `${username} has placed a bet on: "${bet.title}"\n` +
      `The betting action is heating up! 🔥\n\n` +
      `Current Participants: ${bet.participants.length}\n` +
      `Bet Action Level: 🔥🔥🔥`
  );
}
