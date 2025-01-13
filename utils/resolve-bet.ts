import { z } from 'zod';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { env } from '../config/environment';
import search from './perplexity';
import { getCurrentTime } from './gemini';
import { generateObject } from 'ai';

// Create a Google Generative AI instance with the API key
const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY
});

// Define a class to process and resolve bets
export class BetProcessor {
  // Method to search for real-time information about the bet
  private async searchBetOutcome(bet: { title: string; options: string[] }) {
    // Construct a search query using the bet title and options
    const searchQuery = `Resolve the outcome of the bet titled: "${bet.title}". Options are: ${bet.options.join(', ')}`;
    // Perform the search and get the search results
    const searchResults = await search(searchQuery);
    // Return the content of the first search result
    return searchResults.choices[0].message.content;
  }

  // Method to process search results using AI
  private async processSearchResultsWithAI(
    bet: { title: string; options: string[] },
    searchResults: string,
    currentTime: string
  ) {
    // Construct an enhanced prompt using the search results, bet details, and current time
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

    // Use the AI model to generate an object with the correct option and reason
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

    // Return the generated object
    return object;
  }

  // Public method to resolve a bet
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

      // Return the resolved outcome
      return resolvedOutcome;
    } catch (error) {
      console.error('Error resolving bet:', error);
      throw new Error('Failed to resolve the bet.');
    }
  }
}

// Export a function to resolve a bet using AI
export async function resolveWithAI(bet: {
  title: string;
  options: string[];
  votes: Record<string, number>;
}): Promise<{ option: number; reason: string }> {
  const processor = new BetProcessor();

  try {
    // Resolve the bet using the processor
    const resolvedBet = await processor.resolveBet(bet);
    console.log('Resolved Bet Outcome:', resolvedBet);

    // Return the resolved bet outcome with the correct option and reason
    return {
      option: resolvedBet.result,
      reason: resolvedBet.reason
    };
  } catch (error) {
    console.error('Error resolving bet:', error);
    throw error;
  }
}
