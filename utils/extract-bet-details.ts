import { z } from 'zod';
import { prompt } from './prompt';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { env } from '../config/environment';
import search from './openai';
import { getCurrentTime } from './gemini';
import { generateObject, generateText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY
});

interface SearchQueryResult {
  mainQuery: string;
  fallbackQuery?: string;
  category: 'sports' | 'crypto' | 'events' | 'other';
  timeframe: 'immediate' | 'short_term' | 'long_term';
}
// Types for our tool system
type ToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
      }
    >;
    required: string[];
  };
  function: (args: any) => Promise<any>;
};

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  registerTool(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getToolDescriptions(): string {
    return Array.from(this.tools.values())
      .map((tool) => {
        const params = Object.entries(tool.parameters.properties)
          .map(([name, prop]) => `${name} (${prop.type}): ${prop.description}`)
          .join('\n      ');

        return `${tool.name}: ${tool.description}\n    Parameters:\n      ${params}`;
      })
      .join('\n\n');
  }
}

class BetExtractor {
  constructor(private registry: ToolRegistry, private chatType: string) {
    this.setupTools();
  }

  private setupTools() {
    this.registry.registerTool({
      name: 'webSearch',
      description: 'Search the web for current information about events and topics',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          }
        },
        required: ['query']
      },
      function: async (args) => {
        const result = await search(args.query);
        console.log('webSearch result:', result.choices[0].message.content);
        return result.choices[0].message.content;
      }
    });

    this.registry.registerTool({
      name: 'getCurrentTime',
      description: 'Get the current time',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      function: async () => {
        return getCurrentTime();
      }
    });
  }

  private async generateSearchQueries(betDetails: string): Promise<string> {
    const { object } = await generateObject({
      model: google('gemini-2.0-flash-exp'),
      schema: z.object({
        query: z.string()
      }),
      system: `"Analyze the following statement to create a search query that gathers detailed information to construct a structured bet object. Focus on extracting key elements needed for the schema, such as the event or topic (for the title), distinct options for betting, minimum amount (if implied), and relevant timing details (for the end time). Ensure the search query is concise, relevant, and accurately reflects the main subject of the statement.

Statement: '@predotest_bot create a bet on Who will Biden pardon? bet amount should be 1 sol'

Example Schema:
{
  "title": "Match: Manchester City vs Brentford",
  "options": ["Manchester City", "Brentford"],
  "minAmount": 0.01,
  "endTime": "2025-01-10T20:00:00Z"
}
Example Inputs and Outputs:
Input:
"@predotest_bot create a bet on the upcoming match between Manchester City and Brentford. Bet amount should be 1 SOL."
Output Query:
"Manchester City vs Brentford upcoming match details and timing."

Input:
"@cryptobot analyze the latest price trends for Bitcoin and Ethereum over the past week."
Output Query:
"Bitcoin and Ethereum price trends last week and volatility data."

Input:
"Create a bet on the winner of the 2024 U.S. Presidential Election. Minimum bet is 0.5 SOL."
Output Query:
"2024 U.S. Presidential Election candidates and timeline."`,
      prompt: `${betDetails}`
    });

    console.log('Generated search query:', object);
    return object.query;
  }

  async extractBetDetails(betDetails: string): Promise<any> {
    // First, get the current time
    const currentTime = await this.registry.getTool('getCurrentTime')?.function({});

    // Generate and execute multiple search queries
    const query = await this.generateSearchQueries(betDetails);
    const searchResults = await this.registry.getTool('webSearch')?.function({ query });

    // Create the enhanced prompt with tool results
    const enhancedPrompt = this.createEnhancedPrompt(betDetails, currentTime, searchResults);

    // Get the final response using generateObject
    const { object } = await generateObject({
      model: google('gemini-2.0-flash-exp', {
        useSearchGrounding: true
      }),
      schema: z.object({
        title: z.string().min(1),
        options: z.array(z.string()).min(2),
        minAmount: z.number().positive(),
        endTime: z.string()
      }),
      system: prompt(this.chatType).betExtraction,
      prompt: enhancedPrompt
    });

    return object;
  }

  private createEnhancedPrompt(
    betDetails: string,
    currentTime: string,
    searchResults: Array<{ query: string; result: any }>
  ): string {
    const formattedSearchResults = searchResults;

    return `Please analyze this bet request and create a structured bet based on the following information:

Current Time: ${currentTime}

Bet Request: ${betDetails}

Relevant Information:
${formattedSearchResults}

Please create a bet object with:
1. A clear, concise title that captures the essence of the bet
2. At least two distinct betting options
3. A reasonable minimum amount (use 0.01 as default if not specified)
4. An appropriate end time based on the event nature (use the current time as reference)

Ensure the end time is appropriate for the type of bet and expressed in ISO format.`;
  }
}

export async function extractBetDetails(betDetails: string, chatType: string) {
  const registry = new ToolRegistry();
  const extractor = new BetExtractor(registry, chatType);

  try {
    const object = await extractor.extractBetDetails(betDetails);
    console.log('Extracted bet details:', object);
    return object;
  } catch (error) {
    console.error('Error extracting bet details:', error);
    throw error;
  }
}
