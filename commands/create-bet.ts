import { extractBetDetails } from '../utils/gemini';
import Bet from '../models/bet.schema';

export default async function createBet(ctx, chatType) {
  const input =
    ctx.message.text.split('/bet')[1]?.trim() ||
    ctx.message.text.split(`@predofun_bot`)[1]?.trim() ||
    ctx.message.text.trim();
  
  if (!input) {
    ctx.reply(
      `🎲 Bet Challenge Awaits! 🚀\n\n` +
      `Ready to turn your gut feeling into glory? Craft your bet with flair!\n\n` +
      `Example: "Create a bet on whether it will rain tomorrow, minimum bet 5 USDC, ending in 24 hours"\n\n` +
      `💡 Pro Tip: Be specific, be bold, be a bettor! 🔮`
    );
    return;
  }
  
  if (ctx.chat.type === 'private') {
    ctx.reply(
      `🚫 Bet Arena Closed! 🏟️\n\n` +
      `Bets can only be created in group chats. Gather your friends, and let the bet games begin! 🤝`
    );
    return;
  }

  const { object: betDetails } = await extractBetDetails(input, chatType);
  console.log(betDetails);
  
  const betImages = [
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735008150/predo/nhnripvf9walquidrtnt.gif',
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735006898/predo/aom8sxegzlihtr6obvuk.gif',
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735006898/predo/twa2ixbn7coea3icxp1c.gif',
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735008150/predo/admfwfzvisnwclxg9bfi.gif',
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735008150/predo/h51lph81n0uhrl1p4vkd.gif',
    'https://res.cloudinary.com/dbuaprzc0/image/upload/v1735006898/predo/obljk4tsuoinqlfz3i56.gif'
  ];
  
  const bet = {
    betId: `pre-${Math.random().toString(36).substring(2, 4)}${Math.random()
      .toString(36)
      .substring(2, 5)
      .toLowerCase()}`,
    groupId: ctx.chat.id,
    title: betDetails.title,
    options: betDetails.options,
    image: betImages[Math.floor(Math.random() * betImages.length)],
    minAmount: betDetails.minAmount,
    endTime: new Date(betDetails.endTime)
  };
  
  console.log(bet);
  
  const message = await ctx
    .replyWithPhoto(bet.image, {
      caption: 
        `🎲 Challenge Accepted! 🚀\n\n` +
        `Your epic bet "${bet.title}" is now LIVE! 🔥\n\n` +
        `Bet Details:\n` +
        `└ ID: \`${bet.betId.toLowerCase()}\`\n` +
        `└ Minimum Stake: ${bet.minAmount} USDC\n` +
        `└ Ends: ${bet.endTime.toLocaleString()}\n\n` +
        `🤝 Gather your friends, place your bets, and may the smartest bettor win! 💡\n\n` +
        `🔗 Join the bet party: https://t.me/predofun_bot/predofun?startapp=${bet.betId}`
    })
    .then(async (message) => {
      console.log(message.message_id);
      await Bet.create({ ...bet, chatId: message.message_id });
      return message;
    });
  
  await ctx.pinChatMessage(message.message_id);
}
