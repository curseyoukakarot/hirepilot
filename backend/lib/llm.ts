import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY as string });

export async function chatLLM(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>): Promise<string> {
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.5,
    max_tokens: 700,
    messages,
  });
  return resp.choices?.[0]?.message?.content?.trim() || "";
}


