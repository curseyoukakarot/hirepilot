import { z } from 'zod';

// Core instructions derived from knowledge/rex_resume_tools.md
const RESUME_INTEL_INSTRUCTIONS = `
You are REX, a senior career coach and former hiring leader. Apply the resume_intelligence framework:
- Modes: analyze | rewrite | coach | builder_generate.
- Rewrite/Builder steps: (1) Business reason analysis per role → 1–2 sentence why-hired summary. (2) Impact bullets (3–5) tied to the business reason, quantified, no tasks. (3) First-person 4–6 sentence summary with top 3 themes. Tone: first-person, confident, conversational; no fluff/buzzword padding.
- Builder_generate must return STRICT JSON matching:
{
  "targetRole": { "primaryTitle": "string", "focus": ["string"], "industry": ["string"], "notes": "string" },
  "summary": "string",
  "skills": ["string"],
  "experience": [
    { "company": "string", "title": "string", "location": "string", "dates": "string", "whyHiredSummary": "string", "bullets": ["string"], "included": true }
  ]
}
- Analyze/coach: give headings, insights, hiring-manager POV, and next steps. Coach first before rewriting unless explicitly asked.
- Philosophy: resumes support positioning and outreach; never promise a job. Focus on signal, leverage, and clarity.
`;

const RESUME_SCORING_INSTRUCTIONS = `
Resume scoring (resume_scoring):
- Inputs: resume_text, target_role?.
- Score 0–10 across: clarity, impact, cohesion, seniority, differentiation, readability, outreachLeverage. Return overallScore and dimensionScores plus topStrengths, primaryGaps, coachingNotes, recommendedNextActions ["rewrite","targeting","outreach","linkedin"].
- Be honest, hiring-manager POV, actionable next steps.
`;

const LINKEDIN_INTEL_INSTRUCTIONS = `
LinkedIn optimization (linkedin_intelligence):
- Modes: analyze | rewrite.
- Inputs: linkedin_text (required), resume_text?, target_role?.
- Headline: outcome + function; avoid generic stacking.
- About: first-person, story-driven, mirrors resume summary without duplicating; end with positioning.
- Experience: concise, scannable, scope/credibility.
- Output (rewrite): headline, about, experienceGuidance[], profilePositioningNotes. Provide coaching rationale.
`;

const RESUME_OUTREACH_INSTRUCTIONS = `
Resume to outreach angles (resume_to_outreach):
- Inputs: resume_json, target_role?, company_context?.
- Identify 3–5 business problems the candidate can solve; map to experience, proof, and opening lines.
- Output: outreachAngles[{ angleTitle, businessProblem, whyYou, proofPoints[], sampleOpeningLine }], recommendedTargets[], usageNotes.
`;

type ToolDef = {
  parameters: any;
  handler: (args: any) => Promise<any>;
};

const resumeIntelligenceSchema = z.object({
  mode: z.enum(['analyze', 'rewrite', 'coach', 'builder_generate']),
  resume_text: z.string(),
  linkedin_text: z.string().optional(),
  target_role: z.string().optional(),
  target_title: z.string().optional(),
  user_context: z.string().optional(),
});

const resumeScoringSchema = z.object({
  resume_text: z.string(),
  target_role: z.string().optional(),
});

const linkedinIntelSchema = z.object({
  mode: z.enum(['analyze', 'rewrite']),
  linkedin_text: z.string(),
  resume_text: z.string().optional(),
  target_role: z.string().optional(),
});

const resumeOutreachSchema = z.object({
  resume_json: z.any(),
  target_role: z.string().optional(),
  company_context: z.string().optional(),
});

function wrapHandler<T extends z.ZodTypeAny>(schema: T, instructions: string) {
  return async (args: any) => {
    const parsed = schema.parse(args);
    return { instructions, input: parsed };
  };
}

export const resumeTools: Record<string, ToolDef> = {
  resume_intelligence: {
    parameters: {
      mode: { type: 'string', enum: ['analyze', 'rewrite', 'coach', 'builder_generate'] },
      resume_text: { type: 'string' },
      linkedin_text: { type: 'string', optional: true },
      target_role: { type: 'string', optional: true },
      target_title: { type: 'string', optional: true },
      user_context: { type: 'string', optional: true },
    },
    handler: wrapHandler(resumeIntelligenceSchema, RESUME_INTEL_INSTRUCTIONS),
  },
  resume_scoring: {
    parameters: {
      resume_text: { type: 'string' },
      target_role: { type: 'string', optional: true },
    },
    handler: wrapHandler(resumeScoringSchema, RESUME_SCORING_INSTRUCTIONS),
  },
  linkedin_intelligence: {
    parameters: {
      mode: { type: 'string', enum: ['analyze', 'rewrite'] },
      linkedin_text: { type: 'string' },
      resume_text: { type: 'string', optional: true },
      target_role: { type: 'string', optional: true },
    },
    handler: wrapHandler(linkedinIntelSchema, LINKEDIN_INTEL_INSTRUCTIONS),
  },
  resume_to_outreach: {
    parameters: {
      resume_json: { type: 'object' },
      target_role: { type: 'string', optional: true },
      company_context: { type: 'string', optional: true },
    },
    handler: wrapHandler(resumeOutreachSchema, RESUME_OUTREACH_INSTRUCTIONS),
  },
};

