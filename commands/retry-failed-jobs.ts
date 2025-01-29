import { Context } from 'telegraf';
import { retryFailedJobs } from '../utils/queue';

export default async function retryFailedJobsCommand(ctx: Context) {
  try {
    await retryFailedJobs();
    await ctx.reply('✅ All failed jobs have been queued for retry');
  } catch (error) {
    console.error('Error retrying failed jobs:', error);
    await ctx.reply('❌ Error retrying failed jobs. Check logs for details.');
  }
}
