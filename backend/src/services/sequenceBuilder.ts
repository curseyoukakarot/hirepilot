import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function buildThreeStepSequence(input: {
  titleGroups: string[];
  industry?: string;
  painPoints?: string[];
  productName: string;
  spacingBusinessDays?: number;
}) {
  const spacing = input.spacingBusinessDays ?? 2;
  
  const prompt = `Create a concise 3-step cold email sequence for titles [${input.titleGroups.join(', ')}].
Industry: ${input.industry || 'Any'}. Pain points: ${input.painPoints?.join(', ') || 'save time, improve reply rate'}.
Product: ${input.productName}. Tone: helpful, specific, <=120 words each. JSON only:
{ "step1": {"subject": "", "body": ""}, "step2": { ... }, "step3": { ... } }`;

  const r = await openai.chat.completions.create({ 
    model: 'gpt-4o-mini', 
    messages: [{ role: 'user', content: prompt }], 
    temperature: 0.6 
  });
  
  const json = safeJSON(r.choices[0]?.message?.content || '{}');
  return { ...json, spacingBusinessDays: spacing };
}

function safeJSON(s: string) { 
  try { 
    return JSON.parse(s); 
  } catch { 
    return {}; 
  } 
}
