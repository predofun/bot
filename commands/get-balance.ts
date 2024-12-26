import { Connection, PublicKey } from '@solana/web3.js';
import UserWallet from '../models/user-wallet.schema';
import { getWalletBalance } from '../utils/wallet-infra';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { USDC_MINT } from '../utils/helper';

export default async function getBalance(ctx) {
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
  ctx.reply(`Your balance is: ${balance} USDC`);
}
