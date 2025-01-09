import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  ComputeBudgetProgram,
  sendAndConfirmRawTransaction
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';
import { env } from '../config/environment';

const USDC_MINT_ADDRESS_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_MINT_ADDRESS_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const USDC_MINT_ADDRESS = env.MODE === 'dev' ? USDC_MINT_ADDRESS_DEVNET : USDC_MINT_ADDRESS_MAINNET;

export class SolanaService {
  connection: Connection;
  feePayer: Keypair;
  usdcMint: PublicKey;

  constructor(endpoint = env.HELIUS_RPC_URL, feePayerPrivateKey = env.FEE_PAYER) {
    this.connection = new Connection(endpoint, 'processed');
    this.feePayer = Keypair.fromSecretKey(bs58.decode(feePayerPrivateKey));
    this.usdcMint = USDC_MINT_ADDRESS;
  }

  async getOrCreateAssociatedTokenAccount(walletAddress: PublicKey) {
    const associatedTokenAddress = await getAssociatedTokenAddress(this.usdcMint, walletAddress);

    try {
      const account = await this.connection.getAccountInfo(associatedTokenAddress);
      if (!account) {
        const transaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            this.feePayer.publicKey,
            associatedTokenAddress,
            walletAddress,
            this.usdcMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );

        const signature = await sendAndConfirmRawTransaction(
          this.connection,
          transaction.serialize(),
          {
            skipPreflight: true,
            preflightCommitment: 'processed'
          }
        );
        console.log('Created associated token account:', signature);
      }
      return associatedTokenAddress;
    } catch (error) {
      throw new Error(`Error creating associated token account: ${error.message}`);
    }
  }
  async confirmTransaction(
    connection: Connection,
    signature: string,
    maxRetries = 5,
    retryDelay = 5000
  ) {
    for (let i = 0; i < maxRetries; i++) {
      const status = await connection.getSignatureStatus(signature);
      console.log('Signature status:', status);

      if (
        status?.value?.confirmationStatus === 'confirmed' ||
        status?.value?.confirmationStatus === 'finalized'
      ) {
        return true;
      }

      if (status?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    throw new Error('Transaction confirmation timeout');
  }

  async transferUSDC(
    fromWallet: PublicKey,
    toWallet: PublicKey,
    amount: number,
    senderKeypair: Keypair
  ) {
    try {
      const tokenAmount = Math.floor(amount * 1_000_000);
      const [fromTokenAccount, toTokenAccount] = await Promise.all([
        this.getOrCreateAssociatedTokenAccount(fromWallet),
        this.getOrCreateAssociatedTokenAccount(toWallet)
      ]);

      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromWallet,
        tokenAmount
      );

      const transaction = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
        transferInstruction
      );

      transaction.feePayer = this.feePayer.publicKey;

      const latestBlockhash = await this.connection.getLatestBlockhash('processed');
      transaction.recentBlockhash = latestBlockhash.blockhash;

      transaction.sign(senderKeypair, this.feePayer);

      const rawTransaction = transaction.serialize();
      let signature;
      try {
        signature = await sendAndConfirmRawTransaction(this.connection, rawTransaction, {
          skipPreflight: false,
          preflightCommitment: 'processed',
          commitment: 'confirmed',
          maxRetries: 10
        });
      } catch (error) {
        // The signature is available directly in the error object
        const txSignature = error.signature;

        // Or we could parse it from the error message if needed
        const messageMatch = error.message.match(/Check signature (\w+)/);
        const messageSignature = messageMatch ? messageMatch[1] : null;

        // Use the signature from error object (more reliable) or message
        const finalSignature = txSignature || messageSignature;

        if (finalSignature) {
          console.log('Transaction sent with signature:', finalSignature);
          return {
            success: false,
            signature: finalSignature,
            error: error.message,
            message:
              'Transaction sent but confirmation timed out. Please check signature on Solana Explorer.'
          };
        }

        throw error; // Re-throw if we couldn't get the signature
      }
    } catch (error) {
      console.error('Transfer failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getUSDCBalance(walletAddress: string) {
    try {
      const address = new PublicKey(walletAddress);
      const tokenAccount = await getAssociatedTokenAddress(this.usdcMint, address);

      const balance = await this.connection.getTokenAccountBalance(tokenAccount);
      return parseFloat(balance.value.amount) / 1_000_000;
    } catch (error) {
      throw new Error(`Error checking balance: ${error.message}`);
    }
  }
}

export async function sponsorTransferUSDC(
  senderPrivateKey: string,
  recipient: PublicKey,
  amount: number
) {
  const feePayerPrivateKey = env.FEE_PAYER;
  const transfer = new SolanaService(env.HELIUS_RPC_URL, feePayerPrivateKey);

  const senderKeypair = Keypair.fromSecretKey(bs58.decode(senderPrivateKey));

  try {
    const balance = await transfer.getUSDCBalance(senderKeypair.publicKey.toBase58());
    console.log(`Current USDC balance: ${balance}`);

    if (balance < amount) {
      throw new Error('Insufficient USDC balance for the transaction.');
    }

    const result = await transfer.transferUSDC(
      senderKeypair.publicKey,
      recipient,
      amount,
      senderKeypair
    );

    if (result.success) {
      console.log(`Transfer successful! Signature: ${result.signature}`);
      return result;
    } else {
      console.error(`Transfer failed: ${result.error}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}
