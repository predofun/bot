import { extractBetDetails } from '../utils/extract-bet-details';
import Bet from '../models/bet.schema';
import { DateTime } from 'luxon';

export default async function createBet(ctx, chatType) {
  try {
    const input =
      ctx.message.text.split('/bet')[1]?.trim() ||
      ctx.message.text.split(`@${ctx.botInfo.username}`)[1]?.trim();
    console.log('from bet creation', input);
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
    ctx
      .replyWithChatAction('typing')
      .then(() => ctx.reply(`🎲 Processing Bet Creation Request... ⏳`));
    const betDetails = await extractBetDetails(input, chatType);
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
      minAmount: betDetails.minAmount < 1 ? 1 : betDetails.minAmount,
      creatorId: ctx.from.id?.toString() || '',
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
          `└ Ends: ${DateTime.fromJSDate(bet.endTime).toLocaleString(DateTime.DATETIME_FULL)}\n\n` +
          `🤝 Gather your friends, place your bets, and may the smartest bettor win! 💡\n\n` +
          `🔗 Join the bet party: https://t.me/predofun_bot/predofun?startapp=${bet.betId}`
      })
      .then(async (message) => {
        console.log(message.message_id);
        await Bet.create({ ...bet, chatId: message.message_id });
        return message;
      });

    // await ctx.pinChatMessage(message.message_id);
  } catch (error) {
    console.error('Error in createBet:', error);
    ctx.reply(`❌ An unexpected error occurred while creating the bet. Please try again later.`);
  }
}
