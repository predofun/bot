import { Telegraf, Scenes, session, Context } from 'telegraf';
import { Connection, PublicKey } from '@solana/web3.js';
import Bet from './models/bet.schema';
import UserWallet from './models/user-wallet.schema';
import axios from 'axios';
import { config } from 'dotenv';
import { connectDb } from './config/db';
import { env } from './config/environment';
import { extractBetDetails } from './utils/gemini';
import { createWallet, getWalletBalance } from './utils/crossmint';
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

// Create Bet Command
bot.command('create-bet', async (ctx) => {
  await createBet(ctx);
});

// Balance Command
bot.command('balance', async (ctx) => {
await getBalance(ctx)
});

// Join Command (in group chat)
bot.command('join', async (ctx) => {
  await joinBet(ctx)
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
  await resolveBet(ctx)
});

// Start the bot
bot.launch().then(async () => {
  await connectDb();
  console.log('Predo bot is running!');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
