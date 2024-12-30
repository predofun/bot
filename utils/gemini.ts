import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAIProviderMetadata } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { env } from '../config/environment';
import { commands } from './helper';
import { DateTime } from 'luxon';

const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY
});

export async function extractBetDetails(betDetails: string) {
  const object = await generateObject({
    model: google('gemini-2.0-flash-exp', {
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

export async function resolveBetWithAI(bet: {
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
    prompt: `Please verify the outcome of this bet. Search online for more information. Give reason why it's the correct answer and also provide teh date the correct answer happened if possible.Always know that people don't make bet about the past,so if the reason why an answer is correct is before the current date ${getCurrentTime()} then it's not the correct answer. The bet is about: \n\n${
      bet.title
    }\n\n The options are: \n\n${bet.options.join(
      '\n'
    )}\n\nPlease provide the index of the correct option (starts at 0) in the list above.`
  });
  const correctOption = object;
  return correctOption;
}

export async function getPredoGameInfo(query: string) {
  // Predefined responses for common queries
  const predefinedResponses = {
    'how to play': `🎲 Predo Game Guide 🚀
1️⃣ Make a bold claim
2️⃣ Tag @PredoBot 
3️⃣ AI creates wager
4️⃣ Friends join stakes
5️⃣ AI verifies 
6️⃣ Winners paid 💰`,

    'commands': `🤖 Commands:
/balance /fund 
/bet /join 
/vote /resolve`,

    'what is predo': `🔮 Predo.fun: 
Predict & win with friends! 
S'take USD'C, AI decides.`
  };

  // Check for predefined responses first
  const lowerQuery = query.toLowerCase();
  for (const [key, response] of Object.entries(predefinedResponses)) {
    if (lowerQuery.includes(key)) {
      return response;
    }
  }

  // If no predefined response, use Gemini for an ultra-concise answer
  const { text } = await generateText({
    model: google('gemini-2.0-flash-exp', { useSearchGrounding: true }),
    system: `Explain in ONE very short sentence: What is prediction betting?`,
    prompt: query
  });

  // Craft a playful, ultra-concise response
  const predoPersonality = [
    '🎲 Prediction Mode! 🚀',
    '🔮 Bet & Win! 💥',
    '🏆 Predict Champion! 🌟'
  ];

  const randomIntro = predoPersonality[Math.floor(Math.random() * predoPersonality.length)];

  return `${randomIntro}\n\n${text.slice(0, 100)}...`;
}

export function getCurrentTime(): string {
  const now = DateTime.now();

  return now.toLocaleString({
    ...DateTime.DATETIME_FULL,
    weekday: 'long',
    era: undefined
  });
}