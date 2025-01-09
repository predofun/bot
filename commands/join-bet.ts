import { Connection, PublicKey } from '@solana/web3.js';
import UserWallet from '../models/user-wallet.schema';
import Bet from '../models/bet.schema';
import { env } from '../config/environment';
import { sponsorTransferUSDC } from '../utils/solana';
import { extractBetIdFromText } from '../utils/gemini';
import { getWalletBalance } from '../utils/wallet-infra';

const solanaConnection = new Connection(env.HELIUS_RPC_URL!);

export default async function joinBet(ctx: any) {
  try {
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

    const botUsername = '@' + ctx.botInfo?.username;
    console.log(botUsername);
    const betId =
      ctx.message.text.split('/join')[1]?.trim() ||
      ctx.message.text.split(botUsername)[1]?.trim() ||
      ctx.message.text.trim();
    const betIdRegex = /^pre-/;

    let extractedBetId;

    if (betIdRegex.test(betId)) {
      const bet = await Bet.findOne({ betId });
      if (!bet) {
        ctx.reply(
          `🔍 Bet Search Says: Bet Not Found! 🔮\n\n` +
            `The bet ID you entered seems to be a valid bet ID, but it's not in our records. \n` +
            `Please double-check your bet ID and try again! 🔍`
        );
        return;
      }
    } else {
      extractedBetId = await extractBetIdFromText(betId);
      if (!extractedBetId) {
        ctx.reply(
          `🕵️ Bet Detective Says: Invalid Bet Format! 🚨\n\n` +
            `The text you entered does not match the format of a valid bet ID. \n` +
            `Please enter a valid bet ID and try again! 🔍`
        );
        return;
      }
    }
    const bet = await Bet.findOne({ betId: extractedBetId });
    if (!bet) {
      ctx.reply(
        `🔍 Bet Search Says: Bet Not Found! 🔮\n\n` +
          `The bet ID you mentioned from your request was not found in our records. \n` +
          `Please double-check your bet ID and try again! 🔍`
      );
      return;
    }

    const wallet = await UserWallet.findOne({ username }).select('address privateKey');
    if (!wallet) {
      ctx.reply(
        `💼 Wallet Missing in Action! 🚫\n\n` +
          `Start a private chat with the bot to create your bet wallet first. \n` +
          `Your bet journey begins with a single wallet! 🌟`
      );
      return;
    }

    const balance = await getWalletBalance(wallet.address);
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

    const existingParticipant = bet.participants.find((participant) => participant === wallet._id);
    if (existingParticipant) {
      ctx.reply(
        `🤝 You've already joined this bet! 🎯\n\n` +
          `Your bet action is already heating up! 🔥\n\n` +
          `Current Participants: ${bet.participants.length}\n` +
          `Bet Action Level: 🔥🔥🔥`
      );
      return;
    }

    const betAmount = bet.minAmount;
    const transferResult = await sponsorTransferUSDC(
      wallet.privateKey,
      new PublicKey(env.AGENT_ADDRESS),
      betAmount
    );
    ctx.reply(`Adding ${ctx.from?.username} to the bet...`);
    if (!transferResult.success) {
      ctx.reply(`❌ An unexpected error occurred while joining the bet. Please try again later.`);
      return;
    }

    bet.participants.push(username);
    await bet.save();

    ctx.reply(
      `🤝 New Bettor Joins the Bet! 🎯\n\n` +
        `${username} has placed a bet on: "${bet.title}"\n` +
        `The betting action is heating up! 🔥\n\n` +
        `Current Participants: ${bet.participants.length}\n` +
        `Bet Action Level: 🔥🔥🔥`
    );
  } catch (error) {
    console.error('Error in joinBet:', error);
    ctx.reply(`❌ An unexpected error occurred while joining the bet. Please try again later.`);
  }
}
