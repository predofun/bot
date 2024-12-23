import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {env} from '../config/environment';

const perplexity = createOpenAICompatible({
  name: 'perplexity',
  headers: {
    Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
  },
  baseURL: 'https://api.perplexity.ai/',
});

export default perplexity;