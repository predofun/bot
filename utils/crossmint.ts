import { config } from 'dotenv';
import { env } from '../config/environment';

config();
const apiKey = env.CROSSMINT_API_KEY;

export async function createWallet(email: string) {
  const response = await fetch('https://staging.crossmint.com/api/v1-alpha2/wallets', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'solana-custodial-wallet',
      linkedUser: `email:${email.toLowerCase()}@gmail.com`
    })
  });

  return await response.json();
}

// Wallet locator returned from previous step
const walletLocator = 'EFeH...';

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
// Crossmint's API key

// Wallet locator returned from previous step

export async function getWalletBalance(walletLocator: string) {
  const response = await fetch(
    `https://staging.crossmint.com/api/v1-alpha2/wallets/${walletLocator}/balances?currencies=usdc`,
    {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey!,
        'Content-Type': 'application/json'
      }
    }
  );

  return await response.json();
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
