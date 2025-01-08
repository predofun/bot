import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import bs58 from 'bs58';

class SolanaUSDCTransfer {
  connection: Connection
  feePayer: Keypair
  usdcMint: PublicKey
  constructor(
    endpoint = 'https://api.mainnet-beta.solana.com',
    feePayerPrivateKey: string // Uint8Array of private key
  ) {
    this.connection = new Connection(endpoint, 'confirmed');
    this.feePayer = Keypair.fromSecretKey(bs58.decode(feePayerPrivateKey));
    this.usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Mainnet USDC
  }

  async getOrCreateAssociatedTokenAccount(walletAddress) {
    const associatedTokenAddress = await getAssociatedTokenAddress(this.usdcMint, walletAddress);

    try {
      const account = await this.connection.getAccountInfo(associatedTokenAddress);

      if (!account) {
        const transaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            this.feePayer.publicKey,
            associatedTokenAddress,
            walletAddress,
            this.usdcMint
          )
        );

        const signature = await this.connection.sendTransaction(transaction, [this.feePayer]);

        await this.connection.confirmTransaction(signature);
      }

      return associatedTokenAddress;
    } catch (error) {
      throw new Error(`Error creating token account: ${error.message}`);
    }
  }

  async transferUSDC(
    fromWallet, // PublicKey of sender
    toWallet, // PublicKey of recipient
    amount, // Amount in USDC (e.g., 1.5 for 1.50 USDC)
    senderKeypair // For signing the token transfer
  ) {
    try {
      // Convert amount to USDC units (6 decimals)
      const tokenAmount = Math.floor(amount * 1_000_000);

      // Get or create associated token accounts
      const [fromTokenAccount, toTokenAccount] = await Promise.all([
        this.getOrCreateAssociatedTokenAccount(fromWallet),
        this.getOrCreateAssociatedTokenAccount(toWallet)
      ]);

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromWallet,
        tokenAmount,
        [senderKeypair],
        TOKEN_PROGRAM_ID
      );

      // Create and sign transaction
      const transaction = new Transaction().add(transferInstruction);

      // Set fee payer
      transaction.feePayer = this.feePayer.publicKey;

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      // Sign transaction
      transaction.sign(this.feePayer, senderKeypair);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize());

      // Confirm transaction
      await this.connection.confirmTransaction(signature);

      return {
        success: true,
        signature,
        message: `Transferred ${amount} USDC successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Utility method to check USDC balance
  async getUSDCBalance(walletAddress) {
    try {
      const tokenAccount = await getAssociatedTokenAddress(this.usdcMint, walletAddress);

      const balance = await this.connection.getTokenAccountBalance(tokenAccount);
      return parseFloat(balance.value.amount) / 1_000_000; // Convert to USDC
    } catch (error) {
      throw new Error(`Error checking balance: ${error.message}`);
    }
  }
}

// Example usage
async function example() {
  // Initialize with your fee payer private key
  const feePayerPrivateKey = 'new Uint8Array(/* Your private key bytes */);'
  const transfer = new SolanaUSDCTransfer(
    'https://api.mainnet-beta.solana.com',
    feePayerPrivateKey
  );

  // Example transfer
  const sender = new PublicKey('sender_wallet_address');
  const recipient = new PublicKey('recipient_wallet_address');
  const senderKeypair = Keypair.fromSecretKey(bs58.decode('ssksksk'));

  try {
    // Check sender's balance first
    const balance = await transfer.getUSDCBalance(sender);
    console.log(`Current USDC balance: ${balance}`);

    // Perform transfer
    const result = await transfer.transferUSDC(
      sender,
      recipient,
      1.5, // Transfer 1.5 USDC
      senderKeypair
    );

    if (result.success) {
      console.log(`Transfer successful! Signature: ${result.signature}`);
    } else {
      console.error(`Transfer failed: ${result.error}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}
