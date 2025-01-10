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
    votes: { type: Map, of: Number, default: {} },
    image: { type: String },
    chatId: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    pollId: { type: String }
  },
  { timestamps: true }
);

// Add post hook before model creation
BetSchema.post('findOneAndUpdate', async function (doc) {
  try {
    const bet = await Bet.findById(this.getQuery()._id);
    if (!bet || bet.participants.length === 0) return;

    const userWallet = await UserWallet.findById(bet.participants[bet.participants.length - 1]);
    if (!userWallet) return;

    const message =
      `🎉 New bet alert! 🎉\n${userWallet.username} has made a bet on "${bet.title}"! 🤔\n` +
      `Will it be ${bet.options[0]} or ${bet.options[1]}? 🤷‍♂️\nPlace your bets! 🎲`;

    await bot.telegram.sendMessage(bet.groupId, message);
  } catch (error) {
    console.error('Error in bet update hook:', error);
  }
});

// Create model after schema is fully defined
const Bet = mongoose.model<IBet>('Bet', BetSchema);

export default Bet;
