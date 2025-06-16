import { Request, Response } from 'express';
import OpenAI from 'openai';

// Load from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function generateMessage(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { messages, model, temperature, max_tokens } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Missing or invalid messages array' });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: model || 'gpt-4',
      messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 500,
    });

    res.status(200).json({ 
      choices: [{
        message: completion.choices[0].message
      }]
    });
  } catch (err) {
    console.error('[GPT ERROR]', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
}
