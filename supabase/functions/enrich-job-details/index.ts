import { serve } from "https://deno.land/std/http/server.ts";
import OpenAI from "https://deno.land/x/openai/mod.ts";

const openai = new OpenAI(Deno.env.get("OPENAI_API_KEY") || "");

serve(async (req) => {
  try {
    const { description } = await req.json();

    const prompt = `
    Extract job details from the following job description.
    Return JSON with: department, location, experience_level, salary_range.
    If unsure, leave the field empty.

    Job description:
    ${description}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });

    const text = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(text || "{}");
    } catch {
      parsed = {};
    }

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
});
