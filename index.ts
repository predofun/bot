import { Telegraf, Scenes, session, Context, TelegramError } from 'telegraf';
import { Connection, PublicKey } from '@solana/web3.js';
import Bet from './models/bet.schema';
import UserWallet from './models/user-wallet.schema';
import axios from 'axios';
import { config } from 'dotenv';
import { connectDb } from './config/db';
import { env } from './config/environment';
import { classifyCommand, getPredoGameInfo } from './utils/gemini';
import start from './commands/start';
import createBet from './commands/create-bet';
import getPrivateKey from './commands/get-privatekey';
import getBalance from './commands/get-balance';
import joinBet from './commands/join-bet';
import resolveBet from './commands/close-bet';
import fetchBetHistory from './commands/fetch-bet-history';
import { encryptAllWalletPrivateKeys } from './utils/helper';

config();
connectDb();
export interface MyContext extends Context {
  scene: Scenes.SceneContextScene<MyContext>;
}

// Initialize bot and APIs
const bot = new Telegraf<MyContext>(env.TELEGRAM_BOT_TOKEN!);

bot.catch((err, ctx) => {
  if (err instanceof TelegramError && err.response.error_code === 403) {
    console.error('User blocked the bot:', err);
    // Remove user from database or take other necessary action
  }
});

// Start Command (in private chat)
bot.command('start', async (ctx) => {
  await start(ctx);
});

// Create Bet Command
bot.command('bet', async (ctx) => {
  await createBet(ctx, ctx.chat.type);
});

// Balance Command
bot.command('balance', async (ctx) => {
  await getBalance(ctx);
});

bot.command('privatekey', async (ctx) => {
  await getPrivateKey(ctx);
});
// Join Command (in group chat)
bot.command('join', async (ctx) => {
  await joinBet(ctx);
});

// Vote Command
bot.command('vote', async (ctx) => {
  if (ctx.chat.type === 'private') return;

  const username = ctx.from?.username;
  if (!username) {
    ctx.reply('Please set a username in Telegram to use this bot.');
    return;
  }

  const [betId, optionIndex] = ctx.message.text.split('/vote')[1].trim().split(' ');
  const bet = await Bet.findOne({ betId });
  if (!bet) {
    ctx.reply('Invalid bet ID.');
    return;
  }

  if (!bet.participants.includes(username)) {
    ctx.reply('You have not joined this bet.');
    return;
  }

  const option = parseInt(optionIndex);
  if (isNaN(option) || option < 0 || option >= bet.options.length) {
    ctx.reply('Invalid option.');
    return;
  }

  //   bet.votes.set(username, option);
  await bet.save();

  ctx.reply(`Your vote for "${bet.options[option]}" has been recorded.`);
});

// Resolve Command
bot.command('resolve', async (ctx) => {
  await resolveBet(ctx, ctx.chat.type);
});

bot.on('message', async (ctx) => {
  // Check if message contains bot mention
  const botUsername = ctx.botInfo.username;
  const mentionRegex = new RegExp(`@${botUsername}`);
  //@ts-ignore
  const inputText = ctx.update.message?.text;
  if (inputText[0] === '/') return;
  if (ctx.chat.type === 'private' || (mentionRegex.test(inputText) && ctx.chat.type === 'group')) {
    const input = inputText?.replace(mentionRegex, '').trim();
    if (input) {
      const { result: command } = await classifyCommand(input, ctx.chat.type);
      console.log(command);
      switch (command) {
        case 'balance':
          console.log('getting balance');
          return getBalance(ctx);
        case 'bet':
          console.log('betting');
          return createBet(ctx, ctx.chat.type);
        case 'join':
          return joinBet(ctx);
        // case 'vote':
        //   return joinBet(ctx);
        case 'privatekey':
          return getPrivateKey(ctx);

        // Add this to your bot commands
        case 'resolve':
          if (
            //@ts-ignore
            ctx.message.reply_to_message &&
            //@ts-ignore
            ctx.message.reply_to_message.from?.username === bot.botInfo?.username &&
            //@ts-ignore
            ctx.message.reply_to_message.chat.type === 'group'
          ) {
            // This is a reply to the bot's message
            return resolveBet(ctx, ctx.chat.type);
          }
        case 'history':
          return fetchBetHistory(ctx);
        default:
          console.log('predo fun reply');
          const gameInfo = await getPredoGameInfo(input, ctx.from?.username, ctx.chat.type);
          ctx.reply(gameInfo);
      }
    }
  }
});

// bot.launch({
//     webhook: {
//       domain: 'https://predo.up.railway.app',
//       port: 8000
//     }
//   })
//   .then(async () => {
//     // await connectDb();
//     console.info(`The bot ${bot.botInfo.username} is running on server`);
//   });

bot.launch().then(() => {
  // await connectDb();
  console.info(`The bot ${bot.botInfo.username} is running on server`);
});
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

process.on('unhandledRejection', (err) => {
  if (err instanceof TelegramError && err.response.error_code === 403) {
    console.error('User blocked the bot:', err);
    // Remove user from database or take other necessary action
  }
});
