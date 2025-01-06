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

interface WithdrawData {
  address: string;
}

const withdrawScene = new Scenes.WizardScene<MyContext>(
  'withdraw',
  // Step 1: Ask for address
  async (ctx) => {
    await ctx.reply('Please enter the Solana address to withdraw to:');
    ctx.scene.session.withdrawData = {} as WithdrawData;
    return ctx.wizard.next();
  },
  // Step 2: Validate address and ask for amount
  async (ctx) => {
    const address = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

    try {
      const pubkey = new PublicKey(address);
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
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

    const amount = parseFloat(text);
    const { address } = ctx.scene.session.withdrawData;


    if (isNaN(amount) || amount < 0) {
      await ctx.reply('❌ Invalid amount. Please try again with /withdraw');
      return ctx.scene.leave();
    }

    if (amount < 0.01) {
      await ctx.reply(
        '❌ Minimum withdrawal amount is 0.005 SOL. Please try again with /withdraw'
      );
      return ctx.scene.leave();
    }

    try {
      const recipient = new PublicKey(address);
      const user = await UserWallet.findOne({ username: ctx.from?.username });
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
      const transferTx = await transfer(user[0].privateKey, recipient, amount);
      console.log(transferTx);
      await ctx.reply(
        `✅ Successfully withdrew ${amount} SOL to ${address}\nTransaction: https://solscan.io/tx/${transferTx}?cluster=devnet`
      );
    } catch (error) {
      await ctx.reply(`❌ Error processing withdrawal: ${error.message}`);
    }

    return ctx.scene.leave();
  }
);

export default withdrawScene;
