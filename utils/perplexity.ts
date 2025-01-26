import { env } from '../config/environment';
import { getCurrentTime } from './gemini';

export default async function search(query: string) {
  const requestBody = {
    model: 'sonar-pro',
    messages: [
      {
        role: 'system',
        content: 'Be precise and concise.'
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: 0.2,
    top_p: 0.9,
    search_domain_filter: ['perplexity.ai'],
    return_images: false,
    return_related_questions: false,
    search_recency_filter: 'month',
    top_k: 0,
    stream: false,
    presence_penalty: 0,
    frequency_penalty: 1
  };

  const options = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  };

  const response = await fetch('https://api.perplexity.ai/chat/completions', options);
  const data = await response.json();
  console.log('result:', data.choices[0].message.content);
  return data;
}