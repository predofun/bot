import { config } from 'dotenv';
import { env } from '../config/environment';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { SolanaAgentKit, createSolanaTools } from 'solana-agent-kit';
import bs58 from 'bs58';

config();
const connection = new Connection(env.HELIUS_RPC_URL, 'confirmed');
export const SOL_TO_USDC = LAMPORTS_PER_SOL;
const USDC_MINT_ADDRESS_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_MINT_ADDRESS_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDC_MINT_ADDRESS = env.MODE === 'dev' ? USDC_MINT_ADDRESS_DEVNET : USDC_MINT_ADDRESS_MAINNET;
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
function base64ToBS58(base64String) {
  // First convert base64 to Buffer
  const buffer = Buffer.from(base64String, 'base64');
  // Then convert Buffer to base58
  return bs58.encode(buffer);
}
export async function getWalletBalance(walletLocator: string) {
  try {
    const agentWallet = base64ToBS58(Buffer.from(env.AGENT_WALLET, 'base64'));
    console.log(agentWallet);

    const agent = await setupAgent(agentWallet);
    const usdcTokenBalance = await agent.getBalanceOther(
      new PublicKey(walletLocator),
      USDC_MINT_ADDRESS
    );
    if (usdcTokenBalance === null) return 0;
    return usdcTokenBalance;
  } catch (error) {
    console.error('Error from getting wallet balance', error);
  }
}

export async function setupAgent(privateKey: string) {
  const agent = new SolanaAgentKit(privateKey, env.HELIUS_RPC_URL, {
    OPENAI_API_KEY: 'your-api-key'
  });
  return agent;
}

export async function transferUSDC(from: string, to: PublicKey, amount: number) {
  // Transfer SPL token
  try {
    const fromWallet = base64ToBS58(Buffer.from(from, 'base64'));
    console.log(fromWallet);

    const agent = await setupAgent(fromWallet);
    const signature = await agent.transfer(to, amount, USDC_MINT_ADDRESS);
    return signature;
  } catch (error) {
    console.error('Error from transferring USDC', error);
  }
}
