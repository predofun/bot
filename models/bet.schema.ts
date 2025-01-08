import mongoose, { Schema, Document } from 'mongoose';
import UserWallet from './user-wallet.schema';

interface IBet extends Document {
  betId: string;
  title: string;
  options: string[];
  minAmount: number;
  groupId: string;
  endTime: Date;
  participants: string[];
  votes: Record<string, number>;
  image: string;
  chatId: string;
  resolved: boolean;
  pollId: string;
}

const BetSchema: Schema = new Schema({
  betId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  options: { type: [String], required: true },
  minAmount: { type: Number, required: true },
  groupId: { type: String, required: true },
  endTime: { type: Date, required: true },
  participants: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  votes: { type: Map, of: Number, default: {} },
  image: { type: String },
  chatId: { type: String, required: true },
  resolved: { type: Boolean, default: false },
  pollId: { type: String }
});

const Bet = mongoose.model<IBet>('Bet', BetSchema);
BetSchema.post('findOneAndUpdate', async function (doc) {
  const bet = await Bet.findById(this.getQuery()._id);
  if (!bet) return;
  const bot = require('../index').bot;
  const userWallet = await UserWallet.findById(bet.participants[bet.participants.length - 1]);
  if (!userWallet) return;
  const message = `🎉 New bet alert! 🎉\n${userWallet.username} has made a bet on "${bet.title}"! 🤔\nWill it be ${bet.options[0]} or ${bet.options[1]}? 🤷‍♂️\nPlace your bets! 🎲`;
  bot.telegram.sendMessage(bet.groupId, message);
});

export default Bet;
