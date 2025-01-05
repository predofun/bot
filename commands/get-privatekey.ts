
import UserWallet from '../models/user-wallet.schema';
import { decrypt } from '../utils/encryption';

export default async function getPrivateKey(ctx) {
  try {
    // Ensure the user has a username
    const username = ctx.from?.username;
    if (!username) {
      await ctx.reply('🚫 You need a Telegram username to retrieve your private key.');
      return;
    }

    // Find the user's wallet
    const userWallet = await UserWallet.findOne({ username });
    if (!userWallet) {
      await ctx.reply('🤷‍♂️ No wallet found. Use /start to create a wallet first.');
      return;
    }

    // Decrypt the private key (you'll need to implement encryption/decryption)
    const decryptedPrivateKey = decrypt(userWallet.privateKey);

    // Send private key via secure method (preferably encrypted or temporary)
    await ctx.reply(
      '🔐 *IMPORTANT: Keep this private key SECRET and SECURE!*\n\n' +
      '```\n' + 
      decryptedPrivateKey + 
      '\n```',
      { parse_mode: 'Markdown' }
    );

    // Optional: Delete the message after a short time for added security
    setTimeout(async () => {
      try {
        await ctx.deleteMessage();
      } catch (deleteError) {
        console.error('Could not delete private key message', deleteError);
      }
    }, 60000); // Delete after 1 minute

  } catch (error) {
    console.error('Error retrieving private key:', error);
    await ctx.reply('❌ An error occurred while retrieving your private key.');
  }
}