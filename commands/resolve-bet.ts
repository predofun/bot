import axios from "axios";
import Bet from "../models/bet.schema";

export default async function resolveBet(ctx: any){
    if (ctx.chat.type === 'private') return;

  const betId = ctx.message.text.split('/resolve')[1].trim();
  const bet = await Bet.findOne({ betId });
  if (!bet) {
    ctx.reply('Invalid bet ID.');
    return;
  }

  if (bet.resolved) {
    ctx.reply('This bet has already been resolved.');
    return;
  }

  // Use Perplexity API to verify the outcome
  const perplexityResponse = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: 'mixtral-8x7b-instruct',
      messages: [{ role: 'user', content: `Verify the outcome of this bet: ${bet.title}` }]
    },
    {
      headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` }
    }
  );

  const correctOption = parseInt(perplexityResponse.data.choices[0].message.content);
  if (isNaN(correctOption) || correctOption < 0 || correctOption >= bet.options.length) {
    ctx.reply('Failed to verify the bet outcome. Please try again later.');
    return;
  }

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

  bet.resolved = true;
  await bet.save();

  //   ctx.reply(
  //     `Bet resolved. The correct option was: ${bet.options[correctOption]}\nWinners: ${winners.join(
  //       ', '
  //     )}\nEach winner receives: ${winnerPayout} USDC`
  //   );
  ctx.reply('chicken');
}