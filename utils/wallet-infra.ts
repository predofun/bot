import { config } from 'dotenv';
import { env } from '../config/environment';
import {
  Connection,
  GetProgramAccountsFilter,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SolanaJSONRPCError,
  SystemProgram,
  Transaction
} from '@solana/web3.js';
import { transfer } from './helper';
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';

config();
const apiKey = env.CROSSMINT_API_KEY;
const connection = new Connection(env.HELIUS_RPC_URL, 'finalized');
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
  const predoMintAddress = new PublicKey('84R6wZHapPTGobXfsgmBRpoL7C9dHJj16ahRBjxx2637');
  try {
    const filters: GetProgramAccountsFilter[] = [
      {
        dataSize: 165 //size of account (bytes)
      },
      {
        memcmp: {
          offset: 32, //location of our query in the account (bytes)
          bytes: walletLocator //our search criteria, a base58 encoded string
        }
      },
      //Add this search parameter
      {
        memcmp: {
          offset: 0, //number of bytes
          bytes: predoMintAddress.toBase58() //base58 encoded string
        }
      }
    ];
    const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, { filters });
    if (accounts.length === 0) {
      return 0;
    }
    console.log(accounts);
    console.log(`Found ${accounts.length} token account(s) for wallet ${walletLocator}.`);
    const account = accounts[0];
    //Parse the account data
    const parsedAccountInfo: any = account.account.data;
    const mintAddress: string = parsedAccountInfo['parsed']['info']['mint'];
    const tokenBalance: number = parsedAccountInfo['parsed']['info']['tokenAmount']['uiAmount'];
    //Log results
    console.log(`Token Account No. 1: ${account.pubkey.toString()}`);
    console.log(`--Token Mint: ${mintAddress}`);
    console.log(`--Token Balance: ${tokenBalance}`);
    return tokenBalance;
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
