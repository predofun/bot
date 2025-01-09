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
import { getWalletBalance, transferUSDC } from '../utils/wallet-infra';
import { sponsorTransferUSDC } from '../utils/solana';

interface WithdrawData {
  address: string;
}

const withdrawScene = new Scenes.WizardScene<MyContext>(
  'withdraw',
  // Step 1: Ask for address
  async (ctx) => {
    try {
      if (ctx.chat.type !== 'private') return;
      await ctx.reply('Please enter the Solana address to withdraw to:');
      ctx.scene.session.withdrawData = {} as WithdrawData;
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error in withdraw scene step 1:', error);
      await ctx.reply('❌ An unexpected error occurred. Please try again with /withdraw');
      return ctx.scene.leave();
    }
  },
  // Step 2: Validate address and ask for amount
  async (ctx) => {
    try {
      if (ctx.chat.type !== 'private') return;

      const address = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

      const recipientAddress = address.trim();
      if (!PublicKey.isOnCurve(new PublicKey(recipientAddress).toBytes())) {
        await ctx.reply('❌ Invalid recipient address.');
        return ctx.scene.leave();
      }
      ctx.scene.session.withdrawData.address = address;
      await ctx.reply('Enter the amount of USDC to withdraw. Minimum withdrawal is 5 USDC:');
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error in withdraw scene step 2:', error);
      await ctx.reply('❌ Invalid Solana address. Please try again with /withdraw');
      return ctx.scene.leave();
    }
  },
  // Step 3: Process withdrawal
  async (ctx) => {
    try {
      if (ctx.chat.type !== 'private') return;
      const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

      const amount = parseFloat(text);
      const { address } = ctx.scene.session.withdrawData;

      if (isNaN(amount) || amount < 0) {
        await ctx.reply('❌ Invalid amount. Please try again with /withdraw');
        return ctx.scene.leave();
      }

      if (amount < 5) {
        await ctx.reply('❌ Minimum withdrawal amount is 5 USDC. Please try again with /withdraw');
        return ctx.scene.leave();
      }

      const recipient = new PublicKey(address.trim());
      const user = await UserWallet.findOne({ username: ctx.from?.username }).select(
        'address privateKey'
      );

      if (!user) {
        await ctx.reply('❌ User not found. Please try again with /withdraw');
        return ctx.scene.leave();
      }
      const connection = new Connection(env.HELIUS_RPC_URL, 'confirmed');
      const userAddress = new PublicKey(user.address);
      const userBalance = await getWalletBalance(userAddress.toBase58());
      if (userBalance < amount) {
        await ctx.reply(`❌ Insufficient balance. Please try again with /withdraw`);
        return ctx.scene.leave();
      }
      const transferTx = await sponsorTransferUSDC(user.privateKey, recipient, amount);
      ctx
        .replyWithChatAction('typing')
        .then(() => ctx.reply(`🎲 Processing Bet Creation Request... ⏳`));
      await ctx.reply(
        `✅ Successfully withdrew ${amount} USDC to ${address}\nTransaction: https://solscan.io/tx/${
          transferTx.signature
        }?cluster=${env.MODE == 'dev' ? 'devnet' : 'mainnet-beta'}`
      );
    } catch (error) {
      console.error('Error in withdraw scene step 3:', error);
      await ctx.reply('❌ An unexpected error occurred during withdrawal. Please try again.');
      return ctx.scene.leave();
    }

    return ctx.scene.leave();
  }
);

export default withdrawScene;
