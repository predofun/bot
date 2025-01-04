import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Define an interface for type safety
interface Environment {
  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: string;

  // Solana Network Configuration
  SOLANA_NETWORK: string;
  HELIUS_RPC_URL: string;

  // Database Configuration
  MONGODB_URI: string;

  // Optional: Add more environment variables as needed
  NODE_ENV?: string;

  PERPLEXITY_API_KEY?: string;

  // Optional: Add more environment variables as needed
  CROSSMINT_API_KEY?: string;

  GEMINI_API_KEY?: string;

  AGENT_WALLET?: string;
}

// Create an object with environment variables
export const env: Environment = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  SOLANA_NETWORK: process.env.SOLANA_NETWORK || 'devnet',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/predoApp',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
  CROSSMINT_API_KEY: process.env.CROSSMINT_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  AGENT_WALLET: process.env.AGENT_WALLET || '',
  HELIUS_RPC_URL: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_RPC_URL}` || ''
};

// Optional: Add validation function to ensure critical env vars are present
export function validateEnvironment() {
  const requiredVars: (keyof Environment)[] = [
    'TELEGRAM_BOT_TOKEN',
    'HELIUS_RPC_URL',
    'MONGODB_URI',
    'PERPLEXITY_API_KEY',
    'CROSSMINT_API_KEY',
    'GEMINI_API_KEY',
    'AGENT_WALLET',
    'HELIUS_RPC_URL'
  ];

  for (const varName of requiredVars) {
    if (!env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }
}
validateEnvironment();
