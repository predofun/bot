import { Telegraf, Scenes, session, Context } from 'telegraf';
import { Connection, PublicKey } from '@solana/web3.js';
import Bet from './models/bet.schema';
import UserWallet from './models/user-wallet.schema';
import axios from 'axios';
import { config } from 'dotenv';
import { connectDb } from './config/db';
import { env } from './config/environment';
import { classifyCommand, extractBetDetails } from './utils/gemini';
import { createWallet, fundWallet, getWalletBalance } from './utils/crossmint';
import start from './commands/start';
import createBet from './commands/create-bet';
import getBalance from './commands/get-balance';
import joinBet from './commands/join-bet';
import resolveBet from './commands/resolve-bet';

config();

export interface MyContext extends Context {
  scene: Scenes.SceneContextScene<MyContext>;
}

// Initialize bot and APIs
const bot = new Telegraf<MyContext>(env.TELEGRAM_BOT_TOKEN!);

// Connect to MongoDB
connectDb();

// Start Command (in private chat)
bot.command('start', async (ctx) => {
  await start(ctx);
});

// bot.on('text', async (ctx) => {
//   const command = await classifyCommand(ctx.message.text);
//   console.log(command);
// })

// Create Bet Command
bot.command('bet', async (ctx) => {
  await createBet(ctx);
});

// Balance Command
bot.command('balance', async (ctx) => {
  await getBalance(ctx);
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
  await resolveBet(ctx);
});

bot.on('message', async (ctx) => {
  // Check if message contains bot mention
  const botUsername = ctx.botInfo.username;
  const mentionRegex = new RegExp(`@${botUsername}`);
  //@ts-ignore
  const inputText = ctx.update.message?.text;

  if (ctx.chat.type === 'private' || (mentionRegex.test(inputText) && ctx.chat.type === 'group')) {
    // Bot was mentioned in a group or in a private chat, respond to the message
    //@ts-ignore
    const input = inputText?.replace(mentionRegex, '').trim();
    if (input) {
      const { result: command } = await classifyCommand(input);
      console.log(command);
      switch (command) {
        case 'balance':
          console.log('getting balance');
          return getBalance(ctx);
        case 'bet':
          console.log('betting');
          return createBet(ctx);
        case 'join':
          return joinBet(ctx);
        case 'resolve':
          return resolveBet(ctx);
        default:
          console.log('default response');
          ctx.reply(command);
      }
    }
  }
});

// Start the bot
bot
  .launch({
    webhook: {
      domain: 'https://predo-bot-production.up.railway.app',
      port: 10000
    }
  })
  .then(async () => {
    await connectDb();
    console.info(`The bot ${bot.botInfo.username} is running on server`);
  });
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
