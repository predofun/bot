import { Connection, PublicKey } from '@solana/web3.js';
import UserWallet from '../models/user-wallet.schema';
import { getWalletBalance } from '../utils/crossmint';
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

  const balance = await getWalletBalance(wallet.address).catch(async (err) => {
    if (err.response?.status === 500) {
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      return connection.getTokenAccountBalance(
        await getAssociatedTokenAddress(USDC_MINT, new PublicKey(wallet.address))
      );
    }
    throw err;
  });
  console.log(balance);
  const balanceUsdc = balance[0].balances.solana;
  ctx.reply(`Your balance is: ${balanceUsdc / 1e6} USDC`);
}
