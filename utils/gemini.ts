import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAIProviderMetadata } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { env } from '../config/environment';
import { commands } from './helper';

const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY
});

export async function extractBetDetails(betDetails: string) {
  const object = await generateObject({
    model: google('gemini-1.5-flash', {
      useSearchGrounding: true
    }),
    schema: z.object({
      title: z.string().min(1),
      options: z.array(z.string()).min(2),
      minAmount: z.number().int().positive(),
      endTime: z.date()
    }),
    system:
      'Extract bet details from the following text. Provide title, options, minimum bet amount, and end time in date format.',
    prompt: betDetails
  });
  console.log(object);
  return object;
}

export async function classifyCommand(input: string) {
  const { object } = await generateObject({
    model: google('gemini-1.5-flash', {}),
    output: 'enum',
    enum: commands ,
    system: 'You are a command classifer. You are given a response and you have to classify which command it is based on the response.',
    prompt: input
  });
  return object;
}
