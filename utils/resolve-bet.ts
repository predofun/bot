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
  private async searchBetOutcome(bet: { title: string; options: string[], endTime: string}, currentTime: string) {
    // Construct a search query using the bet title and options
    const searchQuery = `
"Given a bet query ${bet.title} with the bet details:
      Bet Details:
      - Title: ${bet.title}
      - Options:
      ${bet.options.map((option, index) => `${index}: ${option}`).join('\n')}
      - End time: ${bet.endTime}
      - Current Time: ${currentTime}
, convert it into a verification query that follows these templates:
For cryptocurrency prices:
'What was X's exact price across major exchanges at time timezone on date?'

For sports events:
'What was the final score/result of X at time timezone on date?'

For political events:
'What was the official outcome/status of X at time timezone on date?'

For social media metrics:
'What were the exact metrics/numbers for X at time timezone on date?'

For numerical predictions:
'What was the exact value/number of X at time timezone on date?'"

Examples:
Input: "will solana be below $165 by jan 15th 2025 12pm pst"
Output: "What was Solana's exact price across major exchanges at 12:00 PM PST on January 15th, 2025?"

Input: "will Arsenal win Premier League by may 15th 2025 5pm gmt"
Output: "What was Arsenal's final position in the Premier League at 5:00 PM GMT on May 15th, 2025?"

Input: "will Trump reach 50M followers by feb 1st 2025 3pm est"
Output: "What was Trump's exact follower count at 3:00 PM EST on February 1st, 2025?"
`;
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
    endTime: string
    votes: Record<string, number>;
  }) {
    try {
      // Step 1: Get the current time
      const currentTime = await getCurrentTime();

      // Step 2: Search for real-time information
      const searchResults = await this.searchBetOutcome(bet, currentTime);

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
  endTime: string
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
