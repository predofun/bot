import { Connection, PublicKey } from '@solana/web3.js';
import UserWallet from '../models/user-wallet.schema';
import Bet from '../models/bet.schema';
import { env } from '../config/environment';

const solanaConnection = new Connection(env.SOLANA_RPC_ENDPOINT!);

export default async function joinBet(ctx: any) {
  if (ctx.chat.type === 'private') return;

  const username = ctx.from?.username;
  if (!username) {
    ctx.reply('Please set a username in Telegram to use this bot.');
    return;
  }

  const betId = ctx.message.text.split('/join')[1].trim();
  const bet = await Bet.findOne({ betId });
  if (!bet) {
    ctx.reply('Invalid bet ID.');
    return;
  }

  const wallet = await UserWallet.findOne({ username });
  if (!wallet) {
    ctx.reply('Please start a private chat with the bot to create a wallet first.');
    return;
  }

  const balance = await solanaConnection.getBalance(new PublicKey(wallet.address));
  if (balance < bet.minAmount) {
    ctx.reply('Insufficient balance to join this bet.');
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

  ctx.reply(`You have successfully joined the bet: ${bet.title}`);
}
