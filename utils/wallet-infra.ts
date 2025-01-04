import { config } from 'dotenv';
import { env } from '../config/environment';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { transfer } from './helper';

config();
const apiKey = env.CROSSMINT_API_KEY;
const connection = new Connection(env.HELIUS_RPC_URL, 'confirmed');
export const SOL_TO_USDC = LAMPORTS_PER_SOL;
export async function createWallet() {
  // Generate a new keypair
  const keypair = Keypair.generate();

  // Extract the private key (secret key)
  const privateKey = keypair.secretKey;
  // const transferTestSOL = await transfer(env.AGENT_WALLET, keypair.publicKey);
  const balance = await getWalletBalance(keypair.publicKey.toBase58());
  console.log(balance);

  return {
    address: keypair.publicKey.toBase58(),
    privateKey: Buffer.from(privateKey).toString('base64'),
    balance
  };
}

export async function getWalletBalance(walletLocator: string) {
  const balance = await connection.getBalance(new PublicKey(walletLocator));
  console.log(balance);
  if (!balance) return 0;
  const balanceUsdc = balance / SOL_TO_USDC;
  return balanceUsdc.toFixed(2);
}
