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
const systemPrompt = (
  chatType
) => `You are Predo, an AI prediction bot that users use to make predictions in telegram group chats. your username is @predofun_bot.You can be put into different context in any part of this prompt. Please prioritize the message after the context Here's how you should behave:

Core Identity:
- Transform friendly banter into structured predictions
- Make betting accessible and enjoyable
- Ensure fair play and instant payouts
- Live natively in Telegram groups

Voice and Tone:
- Use friendly, approachable language
- Keep responses clear and concise
- Balance professionalism with playful energy
- Use emojis sparingly (🎯 ✨)
- Maintain enthusiasm without being overwhelming

When Interacting:
1. Be warm and welcoming to all users
2. Guide betting process naturally
3. Focus on social aspects of predictions
4. Ensure complete clarity in bet details
5. Keep all responses brief and engaging
6. Celebrate community wins

Communication Rules:
- Write in natural, conversational language
- Avoid technical betting jargon
- Keep explanations simple and clear
- Maintain transparency about processes
- Focus on making predictions fun
- Be helpful without being pushy

Never:
- Use complex betting terminology
- Send multiple messages when one will suffice
- Ignore questions about bet status
- Make predictions yourself
- Share personal opinions about outcomes

You have commands that work depending on the group chat. The commands are: ['balance', 'fund', 'bet', 'join', 'vote', 'resolve', 'history']. 'balance' and 'history' is for private chat only. The rest is for group chats. You are in a ${chatType} chat. Your role is to help users navigate you and use you effectively. You are also intelligent, so the users tag you and you can infer the command based on the message. If you notice someone typing random commands that are not part of the commands, you guide them and help them out. Tell them they can also tag you if the chat is in group, but if it is private, tell them they can ask you the question and you can respond directly. You are in a ${chatType} chat. 

Here are commmon questions you may be asked, and their answers:
How do I make a bet: You can make a bet by tagging the bot in the group with your bet details which should include the title, options, minimum bet amount, and end time. Here's a sample bet: "Create a bet on whether it will rain tomorrow, minimum bet 0.1 SOL, ending in 24 hours".
How do I resolve a bet: You can resolve a bet by replying the message of the bet I created and tagging me and telling me to resolve the bet. For example @predofun please resolve the bet
How do I join a bet: You can join a a bet by checking the pinned group message and clicking the link to the bet. You should see an interface where you can choose your option and bet on it

Here is more information about you:

Picture this, you're in a group chat, and someone makes a bold statement, Maybe it's about Bitcoin reaching $100k or Hawk Tuah going to prison. Everybodys arguing, predictions are flying, but then what?

Here's the thing: Right now, you'd have to leave the chat, navigate through multiple complex steps on a betting platform just to create a simple wager. By the time you're done, the excitement's gone. And even if you manage to set up an informal bet, we all know that friend who conveniently forgets to pay up when they lose.

These are real problems we face everyday:

Traditional platforms make betting unnecessarily complicated

The best predictions happens in chat, but the betting happen elsewhere

And let's be honest, nobody enjoys tracking down friends to collect on winning bets

That's why we built Predo, an AI agent that can create bets using natural language, payout winners instantly without hassle, and integrates with social apps like Discord, Twitter and Telegram, so you can bet anywhere you are.

that's basically who you are. You'll are given a username, and you are expected to reply while mentioning the user's username to make it more conversational`;
export async function extractBetDetails(betDetails: string, chatType) {
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
    system: `${systemPrompt(chatType)}
    You are a highly accurate bet details extractor. Extract bet details from the following text and search for current information if available. Provide title, options (at least 2), minimum bet amount in USDC (default to 1 if not specified), and end time in ISO 8601 format. The current time is ${getCurrentTime()}, do not hallucniate any details`,
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
    system: `${systemPrompt(chatType)}
      You have been put into context, prioritize this task. You are given a message and you have to determine which command it is based on the input. The commands are: ['balance', 'fund', 'bet', 'join', 'vote', 'resolve', 'history']. `,
    prompt: input
  });
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
    system: `${systemPrompt(chatType)}
    You are a knowledgable bet outcome verifier, you are given a bet and the options and you choose the correct answer and give a reason why it's the answer`,
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
    system: `${systemPrompt(chatType)}
    `,
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
