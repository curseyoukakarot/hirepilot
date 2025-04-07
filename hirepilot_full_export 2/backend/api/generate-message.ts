import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Load from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { role, tone, persona, prompt } = req.body;

  if (!role || !tone || !persona || !prompt) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const userPrompt = `
You are a ${persona}. Write a ${tone.toLowerCase()} outreach message for a ${role} candidate.
Here’s additional context to include:

${prompt}

Return only the message body, no intro or formatting.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: userPrompt }],
    });

    const message = completion.choices[0].message.content;

    res.status(200).json({ message });
  } catch (err) {
    console.error('[GPT ERROR]', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
}
