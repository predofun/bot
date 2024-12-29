import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAIProviderMetadata } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { env } from '../config/environment';
import { commands } from './helper';
import perplexity from './perplexity';
import { DateTime } from 'luxon';

const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY
});

export async function extractBetDetails(betDetails: string) {
  const object = await generateObject({
    model: google('gemini-1.5-pro', {
      useSearchGrounding: true,
      structuredOutputs: false // This is correct for handling schema limitations
    }),
    schema: z.object({
      title: z.string().min(1),
      options: z.array(z.string()).min(2),
      minAmount: z.number().int().positive(),
      endTime: z.string()
    }),
    system: `You are a highly accurate bet details extractor. Extract bet details from the following text and search for current information if available. Provide title, options (at least 2), minimum bet amount in USDC (default to 1 if not specified), and end time in ISO 8601 format. The current time is ${getCurrentTime()}, do not hallucniate any details`,
    prompt: betDetails
  });
  console.log(object);
  return object;
}

export async function classifyCommand(input: string) {
  const { object } = await generateObject({
    model: google('gemini-2.0-flash-exp', { useSearchGrounding: true }),
    schema: z.object({
      result: z.string()
    }),
    system: `You are predofun_bot, a telegram bot. You are given a message and you have to determine which command it is based on the input. The commands are: ['balance', 'fund', 'bet', 'join', 'vote', 'resolve', 'history']. `,
    prompt: input
  });
  return object;
}

export async function resolveBet(bet: {
  title: string;
  options: string[];
  votes: Record<string, number>;
}) {
  const { object } = await generateObject({
    model: google('gemini-2.0-flash-exp', { useSearchGrounding: true }),
    schema: z.object({
      result: z.number(),
      reason: z.string()
    }),
    system: `You are a knowledgable bet outcome verifier, you are given a bet and the options and you choose the correct answer and give a reason why it's the answer`,
    prompt: `Please verify the outcome of this bet. Search online for more information. Give reason why it's the correct answer. The bet is about: \n\n${bet.title}\n\n The options are: \n\n${bet.options.join(
      '\n'
    )}\n\nThe votes are: \n\n${Object.entries(bet.votes)
      .map(([option, count]) => `${option}: ${count}`)
      .join(
        '\n'
      )}\n\nPlease provide the index of the correct option (starts at 0) in the list above.`
  });
  const correctOption = object.result;
  return correctOption;
}

export function getCurrentTime(): string {
  const now = DateTime.now();

  return now.toLocaleString({
    ...DateTime.DATETIME_FULL,
    weekday: 'long',
    era: undefined
  });
}
