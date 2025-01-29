import { Telegraf, Scenes, session, Context, TelegramError } from 'telegraf';
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
import getOngoingBets from './commands/fetch-group-bet-history';
import withdrawScene from './commands/withdraw-funds';
import retryFailedJobsCommand from './commands/retry-failed-jobs';
import { WizardSessionData } from 'telegraf/typings/scenes';
import { getChatType } from './utils/helper';
import { handleBetResolutionCallback } from './commands/handle-bet-resolution';
import { BetResolverService } from './utils/scheduler';
import { getStats } from './commands/get-stats';

config();
connectDb();

// Extend WizardSessionData to include withdrawData
declare module 'telegraf/typings/scenes' {
  export interface WizardSessionData {
    withdrawData?: {
      address?: string;
    };
  }
}

export interface MyContext extends Context {
  scene: Scenes.SceneContextScene<MyContext, WizardSessionData>;
  wizard: Scenes.WizardContextWizard<MyContext>;
}

// Initialize bot and APIs
export const bot = new Telegraf<MyContext>(env.TELEGRAM_BOT_TOKEN!);

const stage = new Scenes.Stage<MyContext>([withdrawScene]);

// Add session and stage middleware
bot.use(session());
bot.use(stage.middleware());

// Initialize and start the bet resolver service
// const betResolver = new BetResolverService();
// betResolver.start();

// Handle bet resolution callbacks
bot.action(/^(accept_resolution|reject_resolution|vote):.+$/, async (ctx) => {
  await handleBetResolutionCallback(ctx);
});

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

bot.command('withdraw', (ctx) => ctx.scene.enter('withdraw'));

bot.command('privatekey', async (ctx) => {
  await getPrivateKey(ctx);
});

bot.command('history', async (ctx) => {
  await fetchBetHistory(ctx);
});

bot.command('grouphistory', async (ctx) => {
  await getOngoingBets(ctx);
});

bot.command('join', async (ctx) => {
  await joinBet(ctx);
});

// Resolve Command
bot.command('resolve', async (ctx) => {
  await resolveBet(ctx, ctx.chat.type);
});

bot.command('retry_failed_jobs', async (ctx) => {
  // Only allow admin to retry failed jobs

  await retryFailedJobsCommand(ctx);
});

bot.on('message', async (ctx) => {
  // Check if message contains bot mention
  try {
    const botUsername = ctx.botInfo.username;
    const mentionRegex = new RegExp(`@${botUsername}`);
    //@ts-ignore
    const inputText = ctx.update.message?.text;
    const { isGroup, isPrivate, isChannel } = getChatType(ctx);

    if (!inputText || inputText[0] === '/') return;
    if (isPrivate || (mentionRegex.test(inputText) && isGroup)) {
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
          case 'privatekey':
            return getPrivateKey(ctx);
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
            ctx.reply(gameInfo, {
              parse_mode: 'Markdown'
            });
        }
      }
    }
  } catch (error) {
    console.error('coming from global natural handler', error);
  }
});

(async () => {
  try {
    console.log('Starting bot...');

    await bot.launch(async () => {
      console.log('Bot started');
    });

    // listen for error
    bot.catch(async () => {
      // check if bot is still running
      const me = await bot.telegram.getMe();
      if (!me) {
        console.log('Bot is not running. Restarting...');

        bot.launch().catch((err) => {
          console.error('Error restarting bot:', err);
        });
      }
    });
  } catch (error) {
    console.error('Error starting bot:', error);
  }
})();

process.on('unhandledRejection', (err) => {
  if (err instanceof TelegramError && err.response.error_code === 403) {
    console.error('User blocked the bot:', err);
    // Remove user from database or take other necessary action
  }
});
