import { config } from 'dotenv';
import { env } from '../config/environment';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
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
  const balance = (await connection.getBalance(keypair.publicKey)) * SOL_TO_USDC;
  console.log(balance);

  return {
    address: keypair.publicKey.toBase58(),
    privateKey: Buffer.from(privateKey).toString('base64'),
    balance
  };
}

export async function fundWallet(walletLocator: string) {
  const response = await fetch(
    `https://staging.crossmint.com/api/v1-alpha2/wallets/${walletLocator}/balances`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 5,
        currency: 'usdc'
      })
    }
  );

  return await response.json();
}

export async function getWalletBalance(walletLocator: string) {
  const balance = await connection.getBalance(new PublicKey(walletLocator));
  if (!balance) return 0;
  const balanceUsdc = balance * SOL_TO_USDC;
  return balanceUsdc.toFixed(2);
}

export async function createTransaction(walletLocator: string) {
  const response = await fetch(
    `https://staging.crossmint.com/api/v1-alpha2/wallets/${walletLocator}/transactions`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        params: {
          // Base58 encoded transaction returned from previous step
          transaction: '3T4D...'
        }
      })
    }
  );

  return await response.json();
}
