import { z } from 'zod';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { env } from '../config/environment';
import search from './perplexity';
import { getCurrentTime } from './gemini';
import { generateObject } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY
});

class BetProcessor {
  private async searchBetOutcome(bet: { title: string; options: string[] }) {
    const searchQuery = `Resolve the outcome of the bet titled: "${
      bet.title
    }". Options are: ${bet.options.join(', ')}`;
    const searchResults = await search(searchQuery);
    return searchResults.choices[0].message.content;
  }

  private async processSearchResultsWithAI(
    bet: { title: string; options: string[] },
    searchResults: string,
    currentTime: string
  ) {
    const enhancedPrompt = `
      A bet needs resolution. Use the provided search results, bet details, and current time to determine the outcome.

      Bet Details:
      - Title: ${bet.title}
      - Options:
      ${bet.options.map((option, index) => `${index}: ${option}`).join('\n')}
      - Current Time: ${currentTime}

      Search Results:
      ${searchResults}

      Requirements:
      1. Provide the index of the correct option (starting from 0).
      2. Justify the answer with a clear reason, referencing information from the search results.
      3. If no valid outcome is found, respond with -1 and explain why.
    `;

    const { object } = await generateObject({
      model: google('gemini-2.0-flash-exp'),
      schema: z.object({
        result: z.number(), // Index of the correct option, or -1 for invalid
        reason: z.string() // Explanation for the chosen outcome
      }),
      system: `
        You are a knowledgeable verifier for bets. Analyze the provided information and make a well-informed decision.
      `,
      prompt: enhancedPrompt
    });

    return object;
  }

  public async resolveBet(bet: {
    title: string;
    options: string[];
    votes: Record<string, number>;
  }) {
    try {
      // Step 1: Get the current time
      const currentTime = await getCurrentTime();

      // Step 2: Search for real-time information
      const searchResults = await this.searchBetOutcome(bet);

      // Step 3: Process search results using AI
      const resolvedOutcome = await this.processSearchResultsWithAI(
        bet,
        searchResults,
        currentTime
      );

      return resolvedOutcome;
    } catch (error) {
      console.error('Error resolving bet:', error);
      throw new Error('Failed to resolve the bet.');
    }
  }
}

export async function processBet(betDetails: {
  title: string;
  options: string[];
  votes: Record<string, number>;
}) {
  const processor = new BetProcessor();

  try {
    const resolvedBet = await processor.resolveBet(betDetails);
    console.log('Resolved Bet Outcome:', resolvedBet);
    return resolvedBet;
  } catch (error) {
    console.error('Error resolving bet:', error);
    throw error;
  }
}
