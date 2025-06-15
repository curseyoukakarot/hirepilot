import OpenAI from 'openai';
import { supabaseDb } from '../../lib/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ProfileAnalysis {
  workHistory: Array<{
    company: string;
    title: string;
    years: string;
  }>;
  gptNotes: string;
}

export async function analyzeProfile(linkedinUrl: string): Promise<ProfileAnalysis> {
  try {
    // First, fetch the profile data from Proxycurl or similar service
    const response = await fetch(`https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedinUrl)}`, {
      headers: {
        'Authorization': `Bearer ${process.env.PROXYCURL_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch LinkedIn profile');
    }

    const profile = await response.json();
    console.log('Proxycurl profile:', profile);

    // Trim the profile to only the most relevant fields for GPT
    const { full_name, headline, summary, experiences } = profile;
    const trimmedProfile = {
      full_name,
      headline,
      summary,
      experiences: Array.isArray(experiences) ? experiences.slice(0, 5) : [] // limit to 5 most recent jobs
    };
    console.log('Trimmed profile for GPT:', trimmedProfile);

    // Prepare the prompt for GPT
    const prompt = `Analyze this LinkedIn profile and respond in the following strict format:

Work History:
- Company 1 - Title 1 (Years)
- Company 2 - Title 2 (Years)

Professional Summary:
[A concise paragraph summary of the person's career, skills, and achievements.]

Profile data:
${JSON.stringify(trimmedProfile, null, 2)}`;

    // Call GPT-4
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional career analyst. Analyze the provided LinkedIn profile and extract work history and create a professional summary. Respond in the exact format requested."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    const analysis = completion.choices[0].message?.content;
    console.log('Raw GPT response:', analysis);
    if (!analysis) {
      throw new Error('Failed to get analysis from GPT');
    }

    // Parse the GPT response to extract work history and notes
    const workHistoryMatch = analysis.match(/Work History:([\s\S]*?)(?=Professional Summary:|$)/i);
    const notesMatch = analysis.match(/Professional Summary:([\s\S]*?)$/i);

    const workHistory = workHistoryMatch ? parseWorkHistory(workHistoryMatch[1]) : [];
    const gptNotes = notesMatch ? notesMatch[1].trim() : '';

    console.log('Parsed workHistory:', workHistory);
    console.log('Parsed gptNotes:', gptNotes);

    return {
      workHistory,
      gptNotes
    };
  } catch (error) {
    console.error('Error analyzing profile:', error);
    throw error;
  }
}

function parseWorkHistory(text: string): Array<{ company: string; title: string; years: string }> {
  const entries = text.split('\n').filter(line => line.trim());
  const workHistory = [];

  for (const entry of entries) {
    const match = entry.match(/(.*?) - (.*?) \((.*?)\)/);
    if (match) {
      workHistory.push({
        company: match[1].trim(),
        title: match[2].trim(),
        years: match[3].trim()
      });
    }
  }

  return workHistory;
} 