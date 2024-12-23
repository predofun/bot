import mongoose, { Schema, Document } from 'mongoose';

interface IUserWallet extends Document {
  username: string;
  address: string;
}

const UserWalletSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  address: { type: String, required: true }
});

const UserWallet = mongoose.model<IUserWallet>('UserWallet', UserWalletSchema);
export default UserWallet