import { OpenAI } from 'openai';

type Profile = {
  full_name?: string;
  headline?: string;
  summary?: string;
  experiences?: any[];
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const analyzeProfile = async (profileData: Profile) => {
  try {
    const prompt = `Analyze this professional profile and provide insights:
    Name: ${profileData.full_name || 'N/A'}
    Headline: ${profileData.headline || 'N/A'}
    Summary: ${profileData.summary || 'N/A'}
    Experience: ${JSON.stringify(profileData.experiences || [], null, 2)}`;

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