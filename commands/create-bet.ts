import { Context } from 'telegraf';
import { extractBetDetails } from '../utils/gemini';
import { MyContext } from '..';

export default async function createBet(ctx) {
  const input = ctx.message.text.split('/create-bet')[1].trim();
  if (!input) {
    ctx.reply(
      'To create a bet, use natural language to describe the bet, including details like the bet amount and end time. For example: "Create a bet on whether it will rain tomorrow, minimum bet 5 USDC, ending in 24 hours"'
    );
    return;
  }

  const betDetails = await extractBetDetails(input);
  console.log(betDetails);

  // Parse betDetails and create bet object
  //   const bet = new Bet({
  //     betId: Date.now().toString(),
  //     title: betDetails.title,
  //     options: betDetails.options,
  //     minAmount: betDetails.minAmount,
  //     endTime: new Date(betDetails.endTime)
  //   });

  //   await bet.save();
  ctx.reply(`Bet created: ${'Bet'}\nTo join, start a private chat with the bot.`);
}
