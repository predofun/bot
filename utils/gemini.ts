import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAIProviderMetadata } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { env } from '../config/environment';
import { commands } from './helper';
import { DateTime } from 'luxon';
import { prompt } from './prompt';
import { createAISDKTools } from '@agentic/ai-sdk';
// import { ExaClient } from '@agentic/exa';

// const exa = new ExaClient();

// export const createExaClient = () => new ExaClient();
const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY
});

export async function extractBetDetails(betDetails: string, chatType) {
  const object = await generateObject({
    model: google('gemini-2.0-flash-exp', {
      useSearchGrounding: true,
      structuredOutputs: false // This is correct for handling schema limitations
    }),
    // tools: createAISDKTools(exa),
    schema: z.object({
      title: z.string().min(1),
      options: z.array(z.string()).min(2),
      minAmount: z.number().int().positive(),
      endTime: z.string()
    }),
    system: prompt(chatType).betExtraction,
    prompt: betDetails
  });
  console.log(object);
  return object;
}

export async function classifyCommand(input: string, chatType) {
  const { object } = await generateObject({
    model: google('gemini-2.0-flash-exp', { useSearchGrounding: true }),
    schema: z.object({
      result: z.string()
    }),
    system: prompt(chatType).commandClassification,
    prompt: input
  });
  console.log(object, 'command');
  return object;
}

export async function resolveBetWithAI(
  bet: {
    title: string;
    options: string[];
    votes: Record<string, number>;
  },
  chatType
) {
  const { object } = await generateObject({
    model: google('gemini-2.0-flash-exp', { useSearchGrounding: true }),
    schema: z.object({
      result: z.number(),
      reason: z.string()
    }),
    system: `
    You have been put into context, prioritize this task: You are a knowledgable bet outcome verifier, you are given a bet and the options and you choose the correct answer and give a reason why it's the answer`,
    prompt: `Please verify the outcome of this bet. Search online for more information. Give reason why it's the correct answer and also provide teh date the correct answer happened if possible.Always know that people don't make bet about the past,so if the reason why an answer is correct is before the current date ${getCurrentTime()} then it's not the correct answer. The bet is about: \n\n${
      bet.title
    }\n\n The options are: \n\n${bet.options.join(
      '\n'
    )}\n\nPlease provide the index of the correct option (starts at 0) in the list above.`
  });
  const correctOption = object;
  return correctOption;
}

export async function getPredoGameInfo(query: string, username, chatType) {
  // If no predefined response, use Gemini for an ultra-concise answer
  const { text } = await generateText({
    model: google('gemini-2.0-flash-exp', { useSearchGrounding: true }),
    system: prompt(chatType).predoGameInfo,
    prompt: `Username: ${username}: ${query}`
  });
  console.log(text);
  return text;
}

export function getCurrentTime(): string {
  const now = DateTime.now();

  return now.toLocaleString({
    ...DateTime.DATETIME_FULL,
    weekday: 'long',
    era: undefined
  });
}
