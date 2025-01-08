import { Scenes, Markup } from 'telegraf';
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { MyContext } from '../index';
import UserWallet from '../models/user-wallet.schema';
import { transfer } from '../utils/helper';
import { env } from '../config/environment';
import { transferUSDC } from '../utils/wallet-infra';

interface WithdrawData {
  address: string;
}

const withdrawScene = new Scenes.WizardScene<MyContext>(
  'withdraw',
  // Step 1: Ask for address
  async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await ctx.reply('Please enter the Solana address to withdraw to:');
    ctx.scene.session.withdrawData = {} as WithdrawData;
    return ctx.wizard.next();
  },
  // Step 2: Validate address and ask for amount
  async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const address = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

    try {
      const recipientAddress = address.trim();
      if (!PublicKey.isOnCurve(new PublicKey(recipientAddress).toBytes())) {
        await ctx.reply('❌ Invalid recipient address.');
        return ctx.scene.leave();
      }
      ctx.scene.session.withdrawData.address = address;
      await ctx.reply('Enter the amount of SOL to withdraw. Minimum withdrawal is 0.005 SOL:');
      return ctx.wizard.next();
    } catch (error) {
      await ctx.reply('❌ Invalid Solana address. Please try again with /withdraw');
      return ctx.scene.leave();
    }
  },
  // Step 3: Process withdrawal
  async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

    const amount = parseFloat(text);
    const { address } = ctx.scene.session.withdrawData;

    if (isNaN(amount) || amount < 0) {
      await ctx.reply('❌ Invalid amount. Please try again with /withdraw');
      return ctx.scene.leave();
    }

    if (amount < 0.005) {
      await ctx.reply('❌ Minimum withdrawal amount is 5 USDC. Please try again with /withdraw');
      return ctx.scene.leave();
    }

    try {
      console.log(address)
      const recipient = new PublicKey(address.trim());
      const user = await UserWallet.findOne({ username: ctx.from?.username }).select('address privateKey');

      if (!user) {
        await ctx.reply('❌ User not found. Please try again with /withdraw');
        return ctx.scene.leave();
      }
      const connection = new Connection(env.HELIUS_RPC_URL, 'confirmed');
      const userAddress = new PublicKey(user.address);
      const userBalance = (await connection.getBalance(userAddress)) / LAMPORTS_PER_SOL;
      if (userBalance < amount) {
        await ctx.reply(`❌ Insufficient balance. Please try again with /withdraw`);
        return ctx.scene.leave();
      }
      const transferTx = await transferUSDC(user.privateKey, recipient, amount);
      console.log(transferTx);
      await ctx.reply(
        `✅ Successfully withdrew ${amount} USDC to ${address}\nTransaction: https://solscan.io/tx/${transferTx}?cluster=devnet`
      );
    } catch (error) {
      console.log(error);
      await ctx.reply(`❌ Error processing withdrawal. Please try again with /withdraw`);
    }

    return ctx.scene.leave();
  }
);

export default withdrawScene;
