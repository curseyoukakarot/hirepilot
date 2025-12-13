import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type ResumeSectionState = {
  targetRole: { primaryTitle?: string; focus?: string[]; industry?: string[]; notes?: string };
  summary: string;
  skills: string[];
  experience: Array<{
    company: string;
    title: string;
    location?: string;
    dates?: string;
    whyHiredSummary?: string;
    bullets: string[];
    included?: boolean;
  }>;
  contact?: { name?: string; email?: string; linkedin?: string };
};

export function useResumePreview(initial: ResumeSectionState) {
  const [draft, setDraft] = useState<ResumeSectionState>(initial);

  const updateSection = (updates: Partial<ResumeSectionState>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const preview = useMemo(() => draft, [draft]);

  const copyText = () => {
    const blocks: string[] = [];
    if (draft.contact?.name) blocks.push(draft.contact.name);
    if (draft.contact?.email || draft.contact?.linkedin) {
      blocks.push([draft.contact.email, draft.contact.linkedin].filter(Boolean).join(' · '));
    }
    if (draft.summary) blocks.push(`SUMMARY\n${draft.summary}`);
    if (draft.skills?.length) blocks.push(`SKILLS\n${draft.skills.join(' · ')}`);
    if (draft.experience?.length) {
      const exp = draft.experience
        .filter((e) => e.included !== false)
        .map(
          (e) =>
            `${e.title} | ${e.company} ${e.dates || ''}\n${e.whyHiredSummary || ''}\n${(e.bullets || []).join('\n')}`
        )
        .join('\n\n');
      blocks.push(`EXPERIENCE\n${exp}`);
    }
    const text = blocks.filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  const downloadPdf = async (backend: string, draftId?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const res = await fetch(`${backend}/api/jobs/resume/pdf`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ resume_json: draft, draft_id: draftId || null }),
    });
    const data = await res.json();
    if (!res.ok || !data?.url) throw new Error(data?.error || 'pdf_failed');
    window.open(data.url, '_blank');
  };

  return { preview, updateSection, copyText, downloadPdf, setDraft };
}

