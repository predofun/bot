import axios from 'axios';
import Bet from '../models/bet.schema';
import { Telegraf } from 'telegraf';

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
    ctx.reply(
      `🕵️ Bet Resolution Requires Context! 🔍\n\n` +
      `To resolve a bet, you must reply directly to the original bet message. \n` +
      `Let's keep our bet arena organized! 🏟️`
    );
    return;
  }

  const bet = await Bet.findOne({ chatId: repliedToMessageId });
  console.log(bet);
  if (!bet) {
    ctx.reply(
      `🚫 Bet Not Found in the Bet Archives! 🕳️\n\n` +
      `The bet you're trying to resolve seems to have disappeared. \n` +
      `Was it a glitch in the bet matrix? 🤖`
    );
    return;
  }

  if (bet.resolved) {
    ctx.reply(
      `🏁 Bet Already Resolved! 🎉\n\n` +
      `This bet has already been settled. \n` +
      `No time traveling in our bet arena! ⏰`
    );
    return;
  }

  const message = await ctx.replyWithPoll(
    `🤔 Time to Decide the Correct Answer! 🤝\n\n` +
    `The fate of: "${bet.title}" hangs in the balance.\n\n` +
    `Cast your vote and help us uncover the truth! 🔍`,
    bet.options,
    {
      is_anonymous: false,
      allows_multiple_answers: false,
      open_period: 24 * 60 * 60, // 1 day
    }
  );

  setTimeout(async () => {
    const poll = await ctx.telegram.stopPoll(message.chat.id, message.message_id);
    const correctOption = poll.options.indexOf(Math.max(...poll.options.map((option) => option.voter_count)));
    const winners = bet.participants.filter((participant) => {
      const vote = bet.votes[participant];
      return vote === correctOption;
    });
    const prizePool = bet.minAmount * bet.participants.length;
    const winnerPayout = winners.length > 0 ? prizePool / winners.length : 0;

    ctx.reply(
      `🏆 Bet Showdown Results! 🎲\n\n` +
      `The suspense is over for: "${bet.title}"\n\n` +
      `🎯 Correct Option: ${bet.options[correctOption]}\n\n` +
      `${winners.length > 0 
        ? `🥇 Congratulations to our bet champions: ${winners.join(', ')}!\n` +
          `💰 Each winner receives a glorious ${winnerPayout.toFixed(2)} USDC!\n` +
          `Bet mastery at its finest! 🌟`
        : `🤷‍♀️ Looks like no one nailed it this time. \n` +
          `Better luck in the next bet battle! 🍀`}`
    );
    await bet.updateOne({ resolved: true });
  }, 24 * 60 * 60 * 1000); // 1 day
}
