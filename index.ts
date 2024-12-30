import { Telegraf, Scenes, session, Context } from 'telegraf';
import { Connection, PublicKey } from '@solana/web3.js';
import Bet from './models/bet.schema';
import UserWallet from './models/user-wallet.schema';
import axios from 'axios';
import { config } from 'dotenv';
import { connectDb } from './config/db';
import { env } from './config/environment';
import { classifyCommand, extractBetDetails } from './utils/gemini';
import { createWallet, getWalletBalance } from './utils/wallet-infra';
import start from './commands/start';
import createBet from './commands/create-bet';
import getBalance from './commands/get-balance';
import joinBet from './commands/join-bet';
import resolveBet from './commands/resolve-bet';
import fetchBetHistory from './commands/fetch-bet-history';

config();

export interface MyContext extends Context {
  scene: Scenes.SceneContextScene<MyContext>;
}

// Initialize bot and APIs
const bot = new Telegraf<MyContext>(env.TELEGRAM_BOT_TOKEN!);

// bot.catch((err, ctx) => {
//   console.error('Bot error:', err);
//   //@ts-expect-error
//   if (err.response.description?.includes('bot was blocked by the user')) {
//     // Log blocked user
//     console.log(`User ${ctx.from?.id} has blocked the bot`);
//     return;
//   }
// });

// Start Command (in private chat)
bot.command('start', async (ctx) => {
  try {
    await start(ctx).catch((error) => console.log('user has blocked bot'));
  } catch (error) {
    console.log(error);
    if (error) {
      // Handle blocked user case
      console.log(`User has blocked the bot`);
      // Optional: Remove user from your database or mark them as inactive
    }
  }
});

// // Create Bet Command
// bot.command('bet', async (ctx) => {
//   await createBet(ctx);
// });

// // Balance Command
// bot.command('balance', async (ctx) => {
//   await getBalance(ctx);
// });

// // Join Command (in group chat)
// bot.command('join', async (ctx) => {
//   await joinBet(ctx);
// });

// // Vote Command
// bot.command('vote', async (ctx) => {
//   if (ctx.chat.type === 'private') return;

//   const username = ctx.from?.username;
//   if (!username) {
//     ctx.reply('Please set a username in Telegram to use this bot.');
//     return;
//   }

//   const [betId, optionIndex] = ctx.message.text.split('/vote')[1].trim().split(' ');
//   const bet = await Bet.findOne({ betId });
//   if (!bet) {
//     ctx.reply('Invalid bet ID.');
//     return;
//   }

//   if (!bet.participants.includes(username)) {
//     ctx.reply('You have not joined this bet.');
//     return;
//   }

//   const option = parseInt(optionIndex);
//   if (isNaN(option) || option < 0 || option >= bet.options.length) {
//     ctx.reply('Invalid option.');
//     return;
//   }

//   //   bet.votes.set(username, option);
//   await bet.save();

//   ctx.reply(`Your vote for "${bet.options[option]}" has been recorded.`);
// });

// // Resolve Command
// bot.command('resolve', async (ctx) => {
//   await resolveBet(ctx);
// });

// bot.on('message', async (ctx) => {
//   // Check if message contains bot mention
//   const botUsername = ctx.botInfo.username;
//   const mentionRegex = new RegExp(`@${botUsername}`);
//   //@ts-ignore
//   const inputText = ctx.update.message?.text;
//   if (inputText[0] === '/') return;
//   if (ctx.chat.type === 'private' || (mentionRegex.test(inputText) && ctx.chat.type === 'group')) {
//     const input = inputText?.replace(mentionRegex, '').trim();
//     if (input) {
//       const { result: command } = await classifyCommand(input);
//       console.log(command);
//       switch (command) {
//         case 'balance':
//           console.log('getting balance');
//           return getBalance(ctx);
//         case 'bet':
//           console.log('betting');
//           return createBet(ctx);
//         case 'join':
//           return joinBet(ctx);
//         case 'resolve':
//           if (
//             //@ts-ignore
//             ctx.message.reply_to_message &&
//             //@ts-ignore
//             ctx.message.reply_to_message.from?.username === bot.botInfo?.username &&
//             //@ts-ignore
//             ctx.message.reply_to_message.chat.type === 'group'
//           ) {
//             // This is a reply to the bot's message
//             return resolveBet(ctx);
//           }
//         case 'history':
//           return fetchBetHistory(ctx);
//         default:
//           console.log('default response');
//           ctx.reply(command);
//       }
//     }
//   }
// });

Start the bot
bot
  .launch({
    webhook: {
      domain: 'https://predo.up.railway.app',
      port: 8000
    }
  })
  .then(async () => {
    await connectDb();
    console.info(`The bot ${bot.botInfo.username} is running on server`);
  });

// bot.launch().then(async () => {
//   await connectDb();
//   console.info(`The bot ${bot.botInfo.username} is running on server`);
// });
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
