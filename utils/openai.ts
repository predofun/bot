import { env } from '../config/environment';

export default async function search(query: string) {
 console.log('query', query);
  const options = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: `{"model":"llama-3.1-sonar-small-128k-online","messages":[{"role":"system","content":"Be precise and concise."},{"role":"user","content":"${query}"}],"temperature":0.2,"top_p":0.9,"search_domain_filter":["perplexity.ai"],"return_images":false,"return_related_questions":false,"search_recency_filter":"month","top_k":0,"stream":false,"presence_penalty":0,"frequency_penalty":1}`
  };

  const response = await fetch('https://api.perplexity.ai/chat/completions', options).then(
    (response) => response.json()
  );
  console.log('queries', response);
  return response;
}
