// bet-resolver.service.ts
import { CronJob } from 'cron';
import { Connection, PublicKey } from '@solana/web3.js';
import Bet from '../models/bet.schema';
import { bot } from '../index';
import UserWallet from '../models/user-wallet.schema';
import { sponsorTransferUSDC } from './solana';
import { env } from '../config/environment';
import { payoutQueue, pollQueue } from './queue';
import Poll from '../models/poll.schema';
import { resolveWithAI } from './resolve-bet';

export class BetResolverService {
  private cronJob: CronJob;
  private connection: Connection;
  private predoBot: any;

  constructor() {
    this.connection = new Connection(env.HELIUS_RPC_URL, 'confirmed');
    this.cronJob = new CronJob('0 * * * *', this.checkExpiredBets.bind(this));
    this.predoBot = bot;
  }

  start() {
    this.cronJob.start();
  }

  private async checkExpiredBets() {
    try {
      // Query for expired bets with at least one participant
      const expiredBets = await Bet.find({
        endTime: { $lte: new Date() }, // Bets that have ended
        resolved: false, // Not yet resolved
        participants: { $exists: true, $ne: [] } // Ensure there's at least one participant
      });

      console.log('Amount of bets:', expiredBets)

      for (const bet of expiredBets) {
        await this.processBetResolution(bet);
      }
    } catch (error) {
      console.error('Error checking expired bets:', error);
    }
  }

  private async processBetResolution(bet) {
    try {
      if (bet.participants.length < 2) {
        // For single participant bets, queue a refund job
        await payoutQueue.add('single-refund', {
          bet,
          participant: bet.participants[0]
        });
        return;
      }

      // Try to resolve with AI first
      const aiResolution = await resolveWithAI(bet);

      // Create buttons for accepting/rejecting AI resolution
      const buttons = [
        [
          {
            text: '✅ Accept',
            callback_data: `accept_resolution:${bet._id}:${aiResolution.option}`
          },
          { text: '❌ Reject', callback_data: `reject_resolution:${bet._id}` }
        ]
      ];

      // Send resolution message with buttons
      const message = await this.predoBot.telegram.sendMessage(
        bet.groupId,
        `🤖 AI Resolution for bet "${bet.title}"\n\n` +
          `Selected Option: ${bet.options[aiResolution.option]}\n` +
          `Reason: ${aiResolution.reason}\n\n` +
          `Please vote to accept or reject this resolution.`,
        { reply_markup: { inline_keyboard: buttons } }
      );

      // Create a poll entry to track the resolution
      await Poll.create({
        betId: bet._id,
        pollMessageId: message.message_id.toString(),
        groupId: bet.groupId,
        createdAt: new Date()
      });

      // Schedule a check after 24 hours
      await pollQueue.add(
        'finalize-resolution',
        { betId: bet._id },
        { delay: 24 * 60 * 60 * 1000 }
      );
    } catch (error) {
      console.error('Error processing bet resolution:', error);
      try {
        await this.predoBot.telegram.sendMessage(
          bet.groupId,
          `⚠️ There was an error processing bet "${bet.title}". Our team has been notified and will resolve this shortly.`
        );
      } catch (notifyError) {
        console.error('Error sending error notification:', notifyError);
      }
    }
  }

  private async finalizeResolution(betId: string) {
    try {
      const bet = await Bet.findById(betId);
      const poll = await Poll.findOne({ betId, resolved: false });

      if (!bet || !poll) return;

      // If poll has accept/reject votes
      const votes = Array.from(poll.votes.values());
      const acceptVotes = votes.filter((v) => v === 1).length;
      const rejectVotes = votes.filter((v) => v === 0).length;

      if (acceptVotes > rejectVotes) {
        // Process winners based on AI resolution
        const winners = bet.participants.filter(
          (participant) => bet.votes.get(participant.toString()) === poll.aiOption
        );

        if (winners.length > 0) {
          const totalPrizePool = bet.minAmount * bet.participants.length;
          const payoutPerWinner = totalPrizePool / winners.length;

          await payoutQueue.add('multi-payout', {
            bet,
            winners,
            winningOption: poll.aiOption,
            payoutPerWinner
          });
        }
      } else {
        // Create a new poll for manual resolution
        const options = bet.options.map((opt, idx) => ({
          text: opt,
          callback_data: `vote:${bet._id}:${idx}`
        }));
        const pollMsg = await this.predoBot.telegram.sendMessage(
          bet.groupId,
          `🗳️ Manual Resolution Required for "${bet.title}"\n\n` +
            `Please vote for the correct outcome:`,
          { reply_markup: { inline_keyboard: options.map((opt) => [opt]) } }
        );

        await Poll.create({
          betId: bet._id,
          pollMessageId: pollMsg.message_id.toString(),
          groupId: bet.groupId,
          createdAt: new Date()
        });

        // Schedule poll results processing after 24 hours
        await pollQueue.add(
          'process-poll-results',
          { betId: bet._id },
          { delay: 24 * 60 * 60 * 1000 }
        );
      }

      // Mark current poll as resolved
      poll.resolved = true;
      await poll.save();
    } catch (error) {
      console.error('Error in finalizeResolution:', error);
    }
  }

  public async processPollResults(betId: string) {
    try {
      const bet = await Bet.findById(betId);
      const poll = await Poll.findOne({ betId, resolved: false });

      if (!bet || !poll) return;

      // Count votes for each option
      const voteCounts = new Map();
      for (const vote of poll.votes.values()) {
        voteCounts.set(vote, (voteCounts.get(vote) || 0) + 1);
      }

      // Find winning option
      let winningOption = 0;
      let maxVotes = 0;
      for (const [option, count] of voteCounts.entries()) {
        if (count > maxVotes) {
          maxVotes = count;
          winningOption = Number(option);
        }
      }

      // Process payouts
      const winners = bet.participants.filter(
        (participant) => bet.votes.get(participant.toString()) === winningOption
      );

      if (winners.length > 0) {
        const totalPrizePool = bet.minAmount * bet.participants.length;
        const payoutPerWinner = totalPrizePool / winners.length;

        await payoutQueue.add('multi-payout', {
          bet,
          winners,
          winningOption,
          payoutPerWinner
        });

        await this.predoBot.telegram.sendMessage(
          bet.groupId,
          `🎉 Poll results for "${bet.title}"\n\n` +
            `Winning option: ${bet.options[winningOption]}\n` +
            `Number of winners: ${winners.length}\n` +
            `Payout per winner: ${payoutPerWinner} USDC`
        );
      }

      // Mark poll as resolved
      poll.resolved = true;
      await poll.save();
    } catch (error) {
      console.error('Error in processPollResults:', error);
    }
  }
}

// app.ts
const betResolver = new BetResolverService();
betResolver.start();
