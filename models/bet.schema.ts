import mongoose, { Schema, Document, Types } from 'mongoose';
import UserWallet from './user-wallet.schema';
import { bot } from '..';

interface IBet extends Document {
  betId: string;
  title: string;
  options: string[];
  minAmount: number;
  groupId: string;
  endTime: Date;
  participants: Types.ObjectId[];
  votes: Map<string, number>;
  image?: string;
  chatId: string;
  resolved: boolean;
  pollId?: string;
  creatorId: string;
  winner?: string;
  transactionHash?: string;
}

const BetSchema: Schema = new Schema(
  {
    betId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    options: { type: [String], required: true },
    minAmount: { type: Number, required: true },
    groupId: { type: String, required: true },
    endTime: { type: Date, required: true },
    participants: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    creatorId: { type: String, required: true },
    votes: { type: Map, of: Number, default: new Map() },
    image: { type: String },
    chatId: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    pollId: { type: String },
    winner: { type: String },
    transactionHash: { type: String }
  },
  { timestamps: true }
);

// Add post hook before model creation
BetSchema.post('findOneAndUpdate', async function (doc) {
  try {
    const bet = await Bet.findById(this.getQuery()._id);
    const update = this.getUpdate() as any;
    if (!bet || !update.$push || !update.$push.participants) return;

    const newParticipantId = update.$push.participants;
    const userWallet = await UserWallet.findById(newParticipantId);
    if (!userWallet) return;

    const optionsString = bet.options.map((option, index) => `${index + 1}. ${option}`).join('\n');
    const message = `
🎉 New bet participant! 🎉
${userWallet.username} has joined the bet "${bet.title}"!

Options:
${optionsString}

💰 Minimum bet: ${bet.minAmount} USDC
⏰ Ends: ${bet.endTime.toLocaleString()}

Join now with /join ${bet.betId}
`;

    await bot.telegram.sendMessage(bet.groupId, message);
  } catch (error) {
    console.error('Error in bet update hook:', error);
  }
});

// Create model after schema is fully defined
const Bet = mongoose.model<IBet>('Bet', BetSchema);

export default Bet;
