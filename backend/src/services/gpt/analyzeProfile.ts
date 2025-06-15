import axios from 'axios';

export async function analyzeProfile(linkedinUrl: string) {
  try {
    // TODO: Implement actual GPT analysis
    // For now, return mock data
    return {
      workHistory: [
        {
          company: 'Example Corp',
          title: 'Senior Software Engineer',
          startDate: '2020-01',
          endDate: 'Present',
          description: 'Led development of core platform features'
        }
      ],
      gptNotes: 'Experienced software engineer with a focus on full-stack development. Strong background in React, Node.js, and cloud technologies.'
    };
  } catch (error: any) {
    console.error('[analyzeProfile] Error:', error);
    throw new Error(error.message || 'Failed to analyze profile');
  }
} 