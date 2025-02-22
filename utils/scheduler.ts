import { CronJob } from 'cron';
import Queue from 'bull';
import { Connection } from '@solana/web3.js';
import Bet from '../models/bet.schema';
import { env } from '../config/environment';
import Poll from '../models/poll.schema';
import { resolveWithAI } from './resolve-bet';
import mongoose from 'mongoose';
import { payoutQueue, pollQueue } from './queue';
import { Telegraf } from 'telegraf';

export class BetResolverService {
  private cronJob: CronJob;
  private connection: Connection;
  private predoBot: Telegraf;

  constructor(bot?: Telegraf) {
    this.connection = new Connection(env.HELIUS_RPC_URL, 'confirmed');
    this.cronJob = new CronJob('0 */5 * * * *', this.checkExpiredBets.bind(this));
    this.predoBot = bot || new Telegraf(env.TELEGRAM_BOT_TOKEN);
  }

  start() {
    this.cronJob.start();
  }

  private async checkExpiredBets() {
    try {
      // Get all expired bets that haven't been resolved and have participants
      const expiredBets = await Bet.find({
        endTime: { $lte: new Date() }, // Bets that have ended
        resolved: false, // Not yet resolved
        participants: { $exists: true, $ne: [] }, // Ensure there's at least one participant
        _id: {
          $nin: await Poll.distinct('betId', { resolved: false }) // Exclude bets that have unresolved polls
        }
      });

      console.log('Amount of bets:', expiredBets.length);

      for (const bet of expiredBets) {
        await this.processBetResolution(bet);
      }
      await this.processUnpaidBets();
    } catch (error) {
      console.error('Error checking expired bets:', error);
    }
  }

  private async processBetResolution(bet) {
    try {
      if (!bet.groupId) {
        throw new Error(`Bet ${bet._id} has no groupId`);
      }

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

      if (aiResolution.option === -1) {
        try {
          // Create a Telegram poll for manual resolution
          const message = await this.predoBot.telegram.sendPoll(
            bet.groupId,
            `📊 Vote for the correct outcome of bet "${bet.title}"`,
            bet.options,
            {
              is_anonymous: false,
              allows_multiple_answers: false,
              open_period: 3 * 60 * 60 // 3 hours in seconds
            }
          );

          // Create a poll entry to track the resolution
          await Poll.create({
            betId: bet._id,
            pollMessageId: message.message_id.toString(),
            groupId: bet.groupId,
            createdAt: new Date(),
            isManualPoll: true
          });

          // Schedule poll results processing after 3 hours
          await pollQueue.add(
            'process-poll-results',
            { betId: bet._id },
            { delay: 3 * 60 * 60 * 1000 }
          );
        } catch (error) {
          console.error('Error creating manual poll:', error);
          throw error;
        }
        return;
      }

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
        `🤖 Predo's Resolution for bet "${bet.title}"\n\n` +
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
        createdAt: new Date(),
        isManualPoll: false
      });

      // Schedule a check after 1 hour
      await pollQueue.add('finalize-resolution', { betId: bet._id }, { delay: 1 * 60 * 60 * 1000 });
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

  public async finalizeResolution(betId: string) {
    let winningOption = -1; // Initialize to invalid option

    try {
      const bet = await Bet.findById(betId);
      const poll = await Poll.findOne({ betId, resolved: false });

      if (!bet || !poll) {
        return;
      }

      if (!bet.groupId) {
        throw new Error(`Bet ${bet._id} has no groupId`);
      }

      if (!poll.isManualPoll) {
        // For accept/reject polls
        const votes = Array.from(poll.votes.values());
        const acceptVotes = votes.filter((v) => v === 1).length;
        const rejectVotes = votes.filter((v) => v === 0).length;

        if (acceptVotes > rejectVotes) {
          winningOption = poll.aiOption!;
        } else {
          try {
            // Create a new poll for manual resolution
            const sentMessage = await this.predoBot.telegram.sendMessage(
              bet.groupId,
              `🗳️ Manual Resolution for "${bet.title}"\n\nPlease vote for the correct outcome:`,
              {
                reply_markup: {
                  inline_keyboard: bet.options.map((option, index) => [
                    {
                      text: option,
                      callback_data: `vote:${bet._id}:${index}`
                    }
                  ])
                }
              }
            );

            const manualPoll = new Poll({
              betId: bet._id,
              pollMessageId: sentMessage.message_id.toString(),
              groupId: bet.groupId,
              isManualPoll: true,
              resolved: false
            });
            await manualPoll.save();

            // Schedule poll results processing after 3 hours
            await pollQueue.add(
              'process-poll-results',
              { betId: bet._id },
              { delay: 3 * 60 * 60 * 1000 }
            );

            return;
          } catch (error) {
            console.error('Error creating manual poll:', error);
            throw error;
          }
        }
      } else {
        // For manual polls with multiple options
        const votes = Array.from(poll.votes.entries());
        const optionVotes = new Map<number, number>();

        // Count votes for each option
        for (const [_, vote] of votes) {
          optionVotes.set(vote, (optionVotes.get(vote) || 0) + 1);
        }

        // Find option with most votes
        let maxVotes = 0;
        for (const [option, count] of optionVotes.entries()) {
          if (count > maxVotes) {
            maxVotes = count;
            winningOption = option;
          }
        }
      }

      // If no valid winning option was determined, abort
      if (winningOption === -1) {
        console.error('No valid winning option determined');
        return;
      }

      // Mark current poll as resolved and queue up poll results processing
      await Poll.findByIdAndUpdate(poll._id, { resolved: true });

      await pollQueue.add(
        'process-poll-results',
        { betId: bet._id },
        { delay: 0 } // Process immediately since we have the result
      );
    } catch (error) {
      console.error('Error in finalizeResolution:', error);
      throw error;
    }
  }

  public async processPollResults(betId: string) {
    // let winningOption = -1;
    // try {
    //   // Find the poll and bet
    //   const poll = await Poll.findOne({
    //     betId: new mongoose.Types.ObjectId(betId),
    //     resolved: false
    //   });
    //   if (!poll) {
    //     console.error('Poll not found or already resolved');
    //     return;
    //   }
    //   const bet = await Bet.findById(betId);
    //   if (!bet) {
    //     console.error('Bet not found');
    //     return;
    //   }
    //   // Get winning option from poll
    //   if (!poll.isManualPoll && poll.aiOption !== undefined) {
    //     // For AI polls, use the AI option if it was accepted
    //     const votes = Array.from(poll.votes.values());
    //     const totalVotes = votes.length;
    //     const accepts = votes.filter(v => v === 1).length;
    //     if (accepts / totalVotes > 0.5) {
    //       winningOption = poll.aiOption;
    //     }
    //   } else {
    //     // For manual polls, count votes
    //     const votes = Array.from(poll.votes.entries());
    //     const optionVotes = new Map<number, number>();
    //     for (const [_, vote] of votes) {
    //       optionVotes.set(vote, (optionVotes.get(vote) || 0) + 1);
    //     }
    //     // Find option with most votes
    //     let maxVotes = 0;
    //     for (const [option, count] of optionVotes.entries()) {
    //       if (count > maxVotes) {
    //         maxVotes = count;
    //         winningOption = option;
    //       }
    //     }
    //   }
    //   if (winningOption === -1) {
    //     console.log(`❌ No winning option determined for bet ${bet._id}`);
    //     return;
    //   }
    //   console.log(`Winning option: ${bet.options[winningOption]}`);
    //   // Convert votes to Map if it's a plain object
    //   const votesMap =
    //     bet.votes instanceof Map ? bet.votes : new Map(Object.entries(bet.votes || {}));
    //   const winners = bet.participants.filter((participant) => {
    //     const participantId = participant.toString();
    //     const vote = votesMap.get(participantId);
    //     console.log(`Participant ${participantId}: voted ${vote !== undefined ? bet.options[vote] : 'did not vote'} - ${vote === winningOption ? '✅ Winner' : '❌ Not winner'}`);
    //     return vote === winningOption;  // Only winners are those who voted for the winning option
    //   });
    //   const totalPrizePool = bet.minAmount * bet.participants.length;
    //   const platformFee = totalPrizePool * 0.04; // 4% platform fee
    //   const netPrizePool = totalPrizePool - platformFee;
    //   let payoutPerWinner = 0;
    //   if (winners.length > 0) {
    //     payoutPerWinner = netPrizePool / winners.length;
    //     await payoutQueue.add('multi-payout', {
    //       bet,
    //       winners,
    //       winningOption,
    //       payoutPerWinner,
    //       platformFee
    //     });
    //   }
    //   await this.predoBot.telegram.sendMessage(
    //     bet.groupId,
    //     `🎯 Bet "${bet.title}" has been resolved!\n\n` +
    //       `Winning Option: ${bet.options[winningOption]}\n` +
    //       `Number of Winners: ${winners.length}\n` +
    //       `Platform Fee: ${platformFee.toFixed(2)} USDC (4%)\n` +
    //       `Payout per Winner: ${payoutPerWinner.toFixed(2)} USDC`
    //   );
    // } catch (error) {
    //   console.error('Error processing poll results:', error);
    //   throw error;
    // }
  }

  public async processUnpaidBets() {
    try {
      // Get unprocessed bets with resolved polls
      const db = mongoose.connection.db;
      const unprocessedBets = await db
        .collection('bets')
        .aggregate([
          { $match: { resolved: false } },
          {
            $lookup: {
              from: 'polls',
              localField: '_id',
              foreignField: 'betId',
              as: 'poll'
            }
          },
          { $match: { 'poll.resolved': true } },
          { $project: { poll: 0 } }
        ])
        .toArray();

      console.log(`Found ${unprocessedBets.length} unpaid bets with resolved polls`);

      for (const bet of unprocessedBets) {
        console.log('\n========= Processing Bet =========');
        console.log('Bet ID:', bet._id);
        console.log('Title:', bet.title);

        // Find the corresponding poll
        const poll = await Poll.findOne({
          betId: bet._id,
          resolved: true
        });

        if (!poll) {
          console.log(`❌ No resolved poll found for bet ${bet._id}`);
          continue;
        }

        console.log('Poll type:', poll.isManualPoll ? 'Manual' : 'AI');

        // Determine winning option based on poll type
        let winningOption = -1;

        if (!poll.isManualPoll && poll.aiOption !== undefined) {
          // For AI polls, check if AI option was accepted
          const votes = Array.from(poll.votes.values());
          const totalVotes = votes.length;
          const accepts = votes.filter((v) => v === 1).length;

          console.log(`AI Poll - Total votes: ${totalVotes}, Accepts: ${accepts}`);

          if (accepts / totalVotes > 0.5) {
            winningOption = poll.aiOption;
            console.log(`AI option accepted: ${bet.options[winningOption]}`);
          } else {
            // Find the option with most votes and make it the new AI option
            const optionVotes = new Map<number, number>();
            for (const [_, vote] of poll.votes) {
              optionVotes.set(vote, (optionVotes.get(vote) || 0) + 1);
            }
            
            let maxVotes = 0;
            for (const [option, count] of optionVotes.entries()) {
              if (count > maxVotes) {
                maxVotes = count;
                winningOption = option;
              }
            }
            console.log(`Setting majority option as new AI option: ${bet.options[winningOption]}`);
            poll.aiOption = winningOption;
          }
        } else {
          // For manual polls, count option votes
          const optionVotes = new Map<number, number>();

          // Convert poll votes to option votes
          for (const [_, vote] of poll.votes) {
            optionVotes.set(vote, (optionVotes.get(vote) || 0) + 1);
          }

          // Find option with most votes
          let maxVotes = 0;
          for (const [option, count] of optionVotes.entries()) {
            console.log(`Option "${bet.options[option]}": ${count} votes`);
            if (count > maxVotes) {
              maxVotes = count;
              winningOption = option;
            }
          }
        }

        if (winningOption === -1) {
          console.log(`❌ No winning option determined for bet ${bet._id}`);
          continue;
        }

        console.log(`Winning option: ${bet.options[winningOption]}`);

        // Find winners who voted for the correct option
        console.log('\nChecking winners:');
        const winners = bet.participants.filter((participant) => {
          const participantId = participant;
          const votes = bet.votes || {};
          console.log('votes', votes);
          const vote = votes[`${participantId}`];
          const isWinner = bet.options.indexOf(vote) === winningOption;
          console.log(
            `Participant ${participantId}: voted ${
              vote !== undefined
                ? bet.options.filter((option) => option === vote)[0]
                : 'did not vote'
            } - ${isWinner ? '✅ Winner' : '❌ Not winner'}`
          );
          return isWinner;
        });

        console.log(`\nWinners Summary:`);
        console.log(`Total Winners: ${winners.length}`);
        console.log(`Winner IDs:`, winners);

        const totalPrizePool = bet.minAmount * bet.participants.length;
        const platformFee = totalPrizePool * 0.05;
        const netPrizePool = totalPrizePool - platformFee;
        const payoutPerWinner = winners.length > 0 ? netPrizePool / winners.length : 0;

        console.log(`\nPayout Details:`);
        console.log(`Total Prize Pool: ${totalPrizePool} USDC`);
        console.log(`Platform Fee: ${platformFee} USDC`);
        console.log(`Net Prize Pool: ${netPrizePool} USDC`);
        console.log(`Payout Per Winner: ${payoutPerWinner} USDC`);

        // Queue payout
        if (winners.length > 0) {
          console.log(`\n✅ Queueing payout for bet ${bet._id}`);
          await payoutQueue.add('multi-payout', {
            bet,
            winners,
            winningOption,
            payoutPerWinner,
            platformFee
          });
        } else {
          console.log(`\n❌ No winners to pay out for bet ${bet._id}`);
        }

        console.log('=========================================\n');
      }
    } catch (error) {
      console.error('Error processing unpaid bets:', error);
    }
  }
}
