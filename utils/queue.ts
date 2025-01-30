import Queue from 'bull';
import { PublicKey } from '@solana/web3.js';
import { env } from '../config/environment';
import { sponsorTransferUSDC } from './solana';
import UserWallet from '../models/user-wallet.schema';
import Bet from '../models/bet.schema';
import { bot } from '../index';
import { BetResolverService } from './scheduler';

// Create queues
export const payoutQueue = new Queue('bet-payouts', {
  redis: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true,
    removeOnFail: false
  },
  limiter: {
    max: 5,  // Allow 5 jobs per 30 seconds
    duration: 30000
  }
});

export const pollQueue = new Queue('poll-processing', {
  redis: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true,
    removeOnFail: false
  },
  limiter: {
    max: 10,  // Allow 10 jobs per 30 seconds
    duration: 30000
  }
});

// Process single participant refunds
payoutQueue.process('single-refund', async (job) => {
  const { bet, participant } = job.data;

  try {
    const wallet = await UserWallet.findById(participant).select('address');
    if (!wallet) {
      throw new Error('Participant wallet not found');
    }

    const refundResult = await sponsorTransferUSDC(
      env.AGENT_WALLET,
      new PublicKey(wallet.address),
      bet.minAmount
    );

    if (!refundResult?.success) {
      throw new Error('Failed to process refund');
    }

    await Bet.findByIdAndUpdate(bet._id, {
      resolved: true,
      winner: participant,
      transactionHash: refundResult.signature
    });

    try {
      const userWallet = await UserWallet.findById(participant.toString());
      if (bet?.creatorId) {
        await bot.telegram.sendMessage(
          bet.creatorId,
          `🔄 The bet "${bet.title}" has ended.\n\nSince you were the only participant in this bet, we've returned your amount.\n\nTransaction: ${refundResult.signature}`
        );
      }
    } catch (error) {
      console.error('Error sending telegram message:', error);
    }

    return { success: true, signature: refundResult.signature };
  } catch (error) {
    console.error('Error processing single participant refund:', error);
    throw error;
  }
});

// Process multi-participant payouts
payoutQueue.process('multi-payout', async (job) => {
  const { bet, winners, winningOption, payoutPerWinner, platformFee, session } = job.data;

  try {
    const payoutResults = [];

    // Process winners sequentially to avoid rate limits
    for (const winner of winners) {
      const wallet = await UserWallet.findById(winner).select('address');
      if (!wallet) {
        throw new Error(`Winner wallet not found for user ${winner}`);
      }

      const payoutResult = await sponsorTransferUSDC(
        env.AGENT_WALLET,
        new PublicKey(wallet.address),
        payoutPerWinner
      );

      if (!payoutResult?.success) {
        throw new Error(`Failed to process payout for winner ${winner}`);
      }

      payoutResults.push(payoutResult);
    }

    // Transfer platform fee
    if (platformFee > 0) {
      const platformResult = await sponsorTransferUSDC(
        env.AGENT_WALLET,
        new PublicKey(env.REVENUE_WALLET),
        platformFee
      );

      if (!platformResult?.success) {
        throw new Error('Failed to process platform fee');
      }

      payoutResults.push(platformResult);
    }

    await Bet.findByIdAndUpdate(bet._id, {
      resolved: true,
      winner: bet.options[winningOption],
      transactionHash: payoutResults[0].signature
    }).session(session);

    await bot.telegram.sendMessage(
      bet.groupId,
      `🎯 Bet "${bet.title}" resolved!\n` +
        `Winning Option: ${bet.options[winningOption]}\n` +
        `Winners: ${winners.map((w) => `@${w}`).join(', ')}\n` +
        `Platform Fee: ${platformFee.toFixed(2)} USDC (4.5%)\n` +
        `Payout per Winner: ${payoutPerWinner.toFixed(2)} USDC\n` +
        `Transaction: ${payoutResults[0].signature}`
    );

    return { success: true, signature: payoutResults[0].signature };
  } catch (error) {
    console.error('Error processing multi-participant payout:', error);
    throw error;
  }
});

// Process poll results
pollQueue.process('process-poll-results', async (job) => {
  const { betId } = job.data;
  const betResolver = new BetResolverService();
  await betResolver.processPollResults(betId);
});

// Process finalize resolution
pollQueue.process('finalize-resolution', async (job) => {
  const { betId } = job.data;
  const betResolver = new BetResolverService();
  await betResolver.finalizeResolution(betId);
});

// Clean and retry failed jobs
export const retryFailedJobs = async () => {
  // Get all failed jobs from both queues
  const failedPayoutJobs = await payoutQueue.getFailed();
  const failedPollJobs = await pollQueue.getFailed();

  console.log(`Found ${failedPayoutJobs.length} failed payout jobs and ${failedPollJobs.length} failed poll jobs`);

  // Retry all failed jobs
  for (const job of failedPayoutJobs) {
    await job.retry();
  }

  for (const job of failedPollJobs) {
    await job.retry();
  }

  console.log('All failed jobs have been queued for retry');
};

// Handle failed jobs
payoutQueue.on('failed', async (job, error) => {
  console.error(`Job ${job.id} failed:`, error);

  const { bet } = job.data;
  try {
    await bot.telegram.sendMessage(
      bet.groupId,
      `⚠️ There was an error processing the payout for bet "${bet.title}". Our team has been notified and will resolve this shortly.`
    );
  } catch (notifyError) {
    console.error('Error sending failure notification:', notifyError);
  }
});

// Monitor queue health
payoutQueue.on('error', (error) => {
  console.error('Queue error:', error);
});

payoutQueue.on('waiting', (jobId) => {
  console.log(`Job ${jobId} is waiting`);
});

payoutQueue.on('active', (job) => {
  console.log(`Job ${job.id} has started`);
});

payoutQueue.on('completed', (job) => {
  console.log(`Job ${job.id} has completed`);
});
