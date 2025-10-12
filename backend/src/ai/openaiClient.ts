import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('OPENAI_API_KEY not set; resume parsing will fail until configured');
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });


