import { Context } from 'telegraf';
import { extractBetDetails } from '../utils/gemini';
import { MyContext } from '..';
import Bet from '../models/bet.schema';

export default async function createBet(ctx) {
  const input =
    ctx.message.text.split('/bet')[1]?.trim() ||
    ctx.message.text.split(`@predofun_bot`)[1]?.trim() ||
    ctx.message.text.trim();
  if (!input) {
    ctx.reply(
      'To create a bet, use natural language to describe the bet, including details like the bet amount and end time. For example: "Create a bet on whether it will rain tomorrow, minimum bet 5 USDC, ending in 24 hours"'
    );
    return;
  }

  const { object: betDetails } = await extractBetDetails(input);
  console.log(betDetails);
  const bet = await Bet.create({
    betId: `PRE-${Math.random().toString(36).substring(2, 4)}${Math.random()
      .toString(36)
      .substring(2, 5)
      .toLowerCase()}`,
    groupId: ctx.chat.id,
    title: betDetails.title,
    options: betDetails.options,
    minAmount: betDetails.minAmount,
    endTime: new Date(betDetails.endTime)
  });
  console.log(bet);
  const betImages = [
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735008150/predo/nhnripvf9walquidrtnt.gif',
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735008150/predo/szxakvkwzdxzkti4yy8g.gif',
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735006898/predo/aom8sxegzlihtr6obvuk.gif',
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735006898/predo/twa2ixbn7coea3icxp1c.gif',
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735008150/predo/admfwfzvisnwclxg9bfi.gif',
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735008150/predo/h51lph81n0uhrl1p4vkd.gif',
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735006898/predo/obljk4tsuoinqlfz3i56.gif'
  ];
  const message = await ctx.reply(
    `Bet created with id: ${bet.betId.toUpperCase()}\nGo wager now at: https://predo.fun/bets/${
      bet.betId
    }`
  )
  await ctx.pinChatMessage(message.message_id);
}
