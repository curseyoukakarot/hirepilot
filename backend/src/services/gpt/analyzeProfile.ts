import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const analyzeProfile = async (profileData: any) => {
  try {
    const prompt = `Analyze this professional profile and provide insights:
    ${JSON.stringify(profileData, null, 2)}`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4-turbo-preview",
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error analyzing profile:', error);
    throw error;
  }
}; 