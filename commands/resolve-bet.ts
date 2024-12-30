import axios from 'axios';
import Bet from '../models/bet.schema';
import { resolveBetWithAI } from '../utils/gemini';

function extractBetIdFromText(text: string) {
  const regex = /Bet created with id: (pre-\w+)/;
  const match = text.match(regex);
  console.log(match);
  if (match) {
    return match[1];
  }
  return null;
}

export default async function resolveBet(ctx: any) {
  if (ctx.chat.type === 'private') return;

  const repliedToMessageId = ctx.message.reply_to_message?.message_id;
  console.log(repliedToMessageId);
  if (!repliedToMessageId) {
    ctx.reply('Please reply to the message sent by the bot to resolve the bet.');
    return;
  }

  const bet = await Bet.findOne({ chatId: repliedToMessageId });
  console.log(bet);
  if (!bet) {
    ctx.reply('Invalid bet ID.');
    return;
  }

  if (bet.resolved) {
    ctx.reply('This bet has already been resolved.');
    return;
  }

  const resolved = await resolveBetWithAI(bet);
  console.log(resolved);
  const winners = [];
  const prizePool = bet.minAmount * bet.participants.length;
  const winnerPayout = prizePool / winners.length;

  //   for (const winner of winners) {
  //     const wallet = await UserWallet.findOne({ username: winner });
  //     if (wallet) {
  //       await crossmint.transfer({
  //         amount: winnerPayout,
  //         from: process.env.BOT_WALLET_ADDRESS!,
  //         to: wallet.address,
  //         tokenId: 'usdc'
  //       });
  //     }
  //   }

  // bet.resolved = true;
  // await bet.save();
  const correctOption = resolved.result;
  ctx.reply(
    `Bet resolved. The correct option was: ${bet.options[correctOption]}\nWinners: ${winners.join(
      ', '
    )}\nEach winner receives: ${winnerPayout} USDC,`
  );
  ctx.reply(`This is the reason for the answer: ${resolved.reason}`);
}
