import { PublicKey } from '@solana/web3.js';
import { sponsorTransferUSDC } from '../utils/solana';
import { env } from '../config/environment';

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.log('Usage: ts-node sponsor-transfer.ts <sender_private_key> <amount>');
    process.exit(1);
  }

  const [senderPrivateKey, amountStr] = args;
  const amount = parseFloat(amountStr);

  if (isNaN(amount)) {
    console.error('Amount must be a valid number');
    process.exit(1);
  }

  try {
    if (!env.AGENT_WALLET) {
      console.error('AGENT_WALLET environment variable is not set');
      process.exit(1);
    }
    const agentWallet = new PublicKey(env.AGENT_ADDRESS!);
    console.log(`Transferring ${amount} USDC to agent wallet: ${agentWallet.toBase58()}`);

    const result = await sponsorTransferUSDC(senderPrivateKey, agentWallet, amount);

    if (result?.success) {
      console.log('Transfer completed successfully!');
      console.log(`Transaction signature: ${result.signature}`);
    } else {
      console.error('Transfer failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error during transfer:', error);
    process.exit(1);
  }
}

main();
