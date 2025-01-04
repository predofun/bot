import { config } from 'dotenv';
import { env } from '../config/environment';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SolanaJSONRPCError,
  SystemProgram,
  Transaction
} from '@solana/web3.js';
import { transfer } from './helper';

config();
const apiKey = env.CROSSMINT_API_KEY;
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
export const SOL_TO_USDC = 181 / LAMPORTS_PER_SOL;
export async function createWallet() {
  // Generate a new keypair
  const keypair = Keypair.generate();

  // Extract the private key (secret key)
  const privateKey = keypair.secretKey;
  const transferTestSOL = await transfer(env.AGENT_WALLET, keypair.publicKey);
  const balance = await getWalletBalance(keypair.publicKey.toBase58());
  console.log(balance);

  return {
    address: keypair.publicKey.toBase58(),
    privateKey: Buffer.from(privateKey).toString('base64'),
    balance
  };
}

export async function getWalletBalance(walletLocator: string) {
  try {
    const tokenAccount = new PublicKey(walletLocator);
    const balance = await connection.getTokenAccountBalance(tokenAccount);
    console.log(balance);
    if (!balance) {
      return 0;
    }
    console.log(`Amount: ${balance.value.amount}`);
    console.log(`Decimals: ${balance.value.decimals}`);
    return balance;
  } catch (error) {
    if (
      error instanceof SolanaJSONRPCError &&
      error.message.includes('failed to get token account balance')
    ) {
      return 0;
    } else {
      throw error;
    }
  }
}
