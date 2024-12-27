import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAIProviderMetadata } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { env } from '../config/environment';
import { commands } from './helper';
import perplexity from './perplexity';

const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY
});

export async function extractBetDetails(betDetails: string) {
  const object = await generateObject({
    model: google('gemini-1.5-pro-latest', { useSearchGrounding: true }),
    schema: z.object({
      title: z.string().min(1),
      options: z.array(z.string()).min(2),
      minAmount: z.number().int().positive(),
      endTime: z.string()
    }),
    system:
      'Extract bet details from the following text. Provide title, options (at least 2, search for the options if none detected), minimum bet amount in USDC (look for numbers followed by "usdc" or variations of "bet amount"), and end time. For the title and options, search for current information if available. Handle various time formats in ISO 8601 format including relative times like "24 hours" or "next year"',
    prompt: betDetails
  });
  console.log(object);
  return object;
}

export async function classifyCommand(input: string) {
  const { object } = await generateObject({
    model: google('gemini-1.5-flash', { useSearchGrounding: true }),
    schema: z.object({
      result: z.string()
    }),
    system: `You are predofun_bot, a telegram bot. You are given a message and you have to determine which command it is based on the input. The commands are: ['balance', 'fund', 'bet', 'join', 'vote', 'resolve']. `,
    prompt: input
  });
  return object;
}


export async function resolveBet(bet: { title: string, options: string[], votes: Record<string, number> }) {
  const { object } = await generateObject({
    model: google('gemini-1.5-pro-latest', { useSearchGrounding: true }),
    schema: z.object({
      result: z.number()
    }),
    system: `Verify the outcome of this bet: ${bet.title}`,
    prompt: `Please verify the outcome of this bet. The options are: \n\n${bet.options.join('\n')}\n\nThe votes are: \n\n${Object.entries(bet.votes).map(([option, count]) => `${option}: ${count}`).join('\n')}\n\nPlease provide the index of the correct option (starts at 0) in the list above.`
  });
  const correctOption = object.result;
  return correctOption;
}

