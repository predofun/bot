import { Context } from 'telegraf';
import {
  TransactionMessage,
  PublicKey,
  VersionedTransaction,
  Connection,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// USDC token mint address on Solana
export const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

async function createUSDCTransferTransaction(
  senderAddress: string,
  recipientAddress: string,
  amount: number
) {
  // Convert addresses to PublicKeys
  const senderPublicKey = new PublicKey(senderAddress);
  const recipientPublicKey = new PublicKey(recipientAddress);

  // Get associated token accounts for both addresses
  const senderTokenAccount = await getAssociatedTokenAddress(USDC_MINT, senderPublicKey);
  const recipientTokenAccount = await getAssociatedTokenAddress(USDC_MINT, recipientPublicKey);
  console.log('Sender token account:', senderTokenAccount);
  console.log('Recipient token account:', recipientTokenAccount);

  // Amount needs to be converted to base units (multiply by 10^6 for USDC)
  const amountInBaseUnits = amount * 1_000_000;

  // Create new transaction
  const instructions = [];
  const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
  console.log('Recipient account info:', recipientAccountInfo);
  if (!recipientAccountInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        senderPublicKey, // Payer of the account creation fee
        recipientTokenAccount, // The newly created associated token account
        recipientPublicKey, // Owner of the new token account
        USDC_MINT, // The token mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // Add the transfer instruction
  instructions.push(
    createTransferInstruction(
      senderTokenAccount,
      recipientTokenAccount,
      senderPublicKey,
      amountInBaseUnits,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const message = new TransactionMessage({
    instructions,
    recentBlockhash: '11111111111111111111111111111111',
    payerKey: new PublicKey('11111111111111111111111111111112')
  }).compileToV0Message();

  const transaction = new VersionedTransaction(message);

  // Serialize and encode transaction
  return bs58.encode(transaction.serialize());
}

export async function transfer(privateKeyFrom: string, publicKey: PublicKey) {
  const fromKeypair = Keypair.fromSecretKey(Buffer.from(privateKeyFrom, 'base64'));

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: publicKey,
      lamports: LAMPORTS_PER_SOL * 0.1
    })
  );
  await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
}

export const commands = ['balance', 'fund', 'bet', 'join', 'vote', 'resolve'];
