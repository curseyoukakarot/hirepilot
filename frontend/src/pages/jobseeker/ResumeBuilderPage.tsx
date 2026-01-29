import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FaArrowLeft,
  FaBrain,
  FaLink,
  FaPlus,
  FaPen,
  FaLightbulb,
  FaDownload,
  FaCopy,
  FaChevronUp,
  FaChevronDown,
  FaTrash,
} from 'react-icons/fa6';
import { supabase } from '../../lib/supabaseClient';
import { useResumePreview } from '../../hooks/useResumePreview';
import { UploadProgressOverlay } from '../../components/UploadProgressOverlay';

type GeneratedExperience = {
  company: string;
  title: string;
  location?: string;
  dates?: string;
  whyHiredSummary?: string;
  bullets: string[];
  included?: boolean;
};

type GeneratedResumeJson = {
  targetRole: { primaryTitle?: string; focus?: string[]; industry?: string[]; notes?: string };
  summary: string;
  skills: string[];
  experience: GeneratedExperience[];
  contact?: { name?: string; email?: string; linkedin?: string };
};

const defaultResume: GeneratedResumeJson = {
  targetRole: {
    primaryTitle: 'Head of Sales',
    focus: ['Leadership', 'IC', 'Hybrid'],
    industry: ['B2B SaaS', 'Healthtech'],
    notes: 'Short guidance / refined target statement',
  },
  summary:
    "Results-driven sales leader with 8+ years building and scaling high-performing GTM teams in B2B SaaS. Proven track record of driving 40%+ ARR growth through strategic outbound motions and data-driven playbooks. Seeking Head of Sales role to leverage expertise in pipeline architecture and team development.",
  skills: ['GTM Strategy', 'Pipeline Management', 'Outbound Playbooks', 'MEDDIC', 'Team Building', 'SaaS Sales', 'Enterprise Sales', 'Salesforce'],
  experience: [
    {
      company: 'Nimbus Data',
      title: 'Head of Sales',
      location: 'San Francisco, CA',
      dates: '2021 – Present',
      whyHiredSummary: 'Hired to build and scale a remote-first outbound sales org and grow ARR.',
      bullets: [
        'Scaled enterprise sales team from 5 to 15 reps, driving $3M → $13.2M ARR in 18 months',
        'Implemented MEDDIC + Salesforce automation, cutting sales cycle by 25% and lifting win rate by 35%',
        'Closed 3 enterprise deals worth $2M+ each via strategic Fortune 500 partnerships',
      ],
      included: true,
    },
    {
      company: 'CloudSync Technologies',
      title: 'Sales Manager',
      location: 'Remote',
      dates: '2018 – 2021',
      whyHiredSummary: 'Brought in to formalize outbound motion and coach mid-market team.',
      bullets: [
        'Built outbound playbooks that increased SQLs by 60% QoQ',
        'Launched weekly deal reviews improving forecast accuracy by 22%',
        'Grew pipeline coverage from 2.5x to 4.1x within 2 quarters',
      ],
      included: false,
    },
  ],
};

async function authHeaders(opts?: { includeJson?: boolean }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (opts?.includeJson !== false) headers['Content-Type'] = 'application/json';
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  return headers;
}

function getBackendBase() {
  const env = String((import.meta as any)?.env?.VITE_BACKEND_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  try {
    const host = typeof window !== 'undefined' ? window.location.host : '';
    if (host.endsWith('thehirepilot.com')) return 'https://api.thehirepilot.com';
  } catch {}
  return 'http://localhost:8080';
}

export default function ResumeBuilderPage() {
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draftId');
  const backend = getBackendBase();

  const { preview, updateSection, copyText, downloadPdf, setDraft } = useResumePreview(defaultResume);
  const [resume, setResume] = useState<GeneratedResumeJson>(defaultResume);
  const hydratedFromLocalRef = React.useRef(false);
  const draftKeyRef = React.useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const [targetTitle, setTargetTitle] = useState<string>(defaultResume.targetRole.primaryTitle || 'Head of Sales');
  const [targetStyle, setTargetStyle] = useState<string>('Leadership');
  const [targetLoading, setTargetLoading] = useState<string | null>(null);
  const [activeExperienceIndex, setActiveExperienceIndex] = useState<number>(0);
  const [expTitle, setExpTitle] = useState<string>(defaultResume.experience[0]?.title || '');
  const [expCompany, setExpCompany] = useState<string>(defaultResume.experience[0]?.company || '');
  const [expLocation, setExpLocation] = useState<string>(defaultResume.experience[0]?.location || '');
  const [expDates, setExpDates] = useState<string>(defaultResume.experience[0]?.dates || '');
  const [expNotes, setExpNotes] = useState<string>(defaultResume.experience[0]?.whyHiredSummary || '');
  const [bulletsLoading, setBulletsLoading] = useState<boolean>(false);
  const [summaryText, setSummaryText] = useState<string>(defaultResume.summary);
  const [skillsText, setSkillsText] = useState<string>(defaultResume.skills.join(', '));
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [viewBullets, setViewBullets] = useState<Record<number, boolean>>({});
  const [bulletSelections, setBulletSelections] = useState<Record<number, { text: string; selected: boolean }[]>>({});
  const [selectedIndustry, setSelectedIndustry] = useState<string>((defaultResume.targetRole.industry || [])[0] || 'B2B');
  const [customIndustryOpen, setCustomIndustryOpen] = useState<boolean>(false);
  const [customIndustryText, setCustomIndustryText] = useState<string>('');
  const [parsingUpload, setParsingUpload] = useState<boolean>(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('ATS-Safe Classic');
  const [templateLoading, setTemplateLoading] = useState<boolean>(false);
  const [selectedTemplateConfig, setSelectedTemplateConfig] = useState<any>({});
  const [selectedTemplateSlug, setSelectedTemplateSlug] = useState<string>('ats_safe_classic');

  const resolveLocalDraftKey = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id || 'anon';
      const id = draftId ? String(draftId) : 'default';
      return `hp_resume_builder_draft_v1:${userId}:${id}`;
    } catch {
      const id = draftId ? String(draftId) : 'default';
      return `hp_resume_builder_draft_v1:anon:${id}`;
    }
  }, [draftId]);

  // Restore local draft on mount so tab switches / remounts don't wipe work
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const key = await resolveLocalDraftKey();
        draftKeyRef.current = key;
        const raw = sessionStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const payload = parsed?.resume || null;
        if (!payload || typeof payload !== 'object') return;
        if (cancelled) return;
        hydratedFromLocalRef.current = true;
        applyResumeJson(payload as GeneratedResumeJson);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveLocalDraftKey]);

  // Autosave local draft (sessionStorage)
  useEffect(() => {
    let t: any = null;
    try {
      const key = draftKeyRef.current;
      if (!key) return;
      t = setTimeout(() => {
        try {
          sessionStorage.setItem(
            key,
            JSON.stringify({
              updatedAt: Date.now(),
              resume: preview,
            })
          );
        } catch {}
      }, 300);
    } catch {}
    return () => {
      try {
        if (t) clearTimeout(t);
      } catch {}
    };
  }, [preview]);
  const markTargetRoleStep = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const backend = import.meta.env.VITE_BACKEND_URL || '';
      await fetch(`${backend}/api/jobs/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ step: 'target_role_set', metadata: { source: 'resume_builder' } }),
      });
    } catch (e) {
      console.warn('onboarding target_role_set failed (non-blocking)', e);
    }
  }, []);

  const markResumeDownloaded = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const backend = import.meta.env.VITE_BACKEND_URL || '';
      await fetch(`${backend}/api/jobs/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ step: 'resume_generated', metadata: { source: 'download_resume' } }),
      });
    } catch (e) {
      console.warn('onboarding resume_generated (download) failed (non-blocking)', e);
    }
  }, []);

  useEffect(() => {
    if (!draftId) return;
    if (hydratedFromLocalRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const headers = await authHeaders();
        const res = await fetch(`${backend}/api/jobs/resume-drafts/${draftId}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load draft');
        const payload = (data?.draft?.generated_resume_json || null) as GeneratedResumeJson | null;
        if (payload && !cancelled) {
          applyResumeJson(payload);
        }
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || 'Failed to load draft');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backend, draftId]);

  // Load current resume template selection (used for export already; here we just display it in the UI)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setTemplateLoading(true);
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const resp = await fetch(`${backend}/api/resume-templates`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) return;
        const list = Array.isArray(json?.templates) ? json.templates : [];
        const selectedId = json?.selectedTemplateId || null;
        const selected = selectedId ? list.find((t: any) => t.id === selectedId) : list.find((t: any) => t.slug === 'ats_safe_classic');
        if (!cancelled) {
          setSelectedTemplateName(selected?.name || 'ATS-Safe Classic');
          setSelectedTemplateConfig(selected?.template_config || {});
          setSelectedTemplateSlug(selected?.slug || 'ats_safe_classic');
        }
      } catch {
        // non-blocking
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backend]);

  // Derive preview tokens from selected template_config (client-side preview only)
  const previewTokens = useMemo(() => {
    const cfg = selectedTemplateConfig || {};
    const slug = selectedTemplateSlug || 'ats_safe_classic';
    const accentColor =
      typeof cfg?.accentColor === 'string' && cfg.accentColor
        ? cfg.accentColor
        : slug === 'modern_timeline'
          ? '#10B981'
          : slug === 'executive_sidebar'
            ? '#4F46E5'
            : slug === 'brand_header_clean'
              ? '#7C3AED'
              : '#365F91';
    const layout =
      typeof cfg?.layout === 'string' && cfg.layout
        ? cfg.layout
        : slug === 'executive_sidebar'
          ? 'twoColumn'
          : 'single';
    const experienceStyle =
      typeof cfg?.experienceStyle === 'string' && cfg.experienceStyle
        ? cfg.experienceStyle
        : slug === 'modern_timeline'
          ? 'timeline'
          : 'default';
    const headerStyle =
      typeof cfg?.headerStyle === 'string' && cfg.headerStyle
        ? cfg.headerStyle
        : slug === 'brand_header_clean'
          ? 'brand'
          : 'default';
    const fontFamily = typeof cfg?.fontFamily === 'string' ? cfg.fontFamily : undefined;
    const compact = slug === 'compact_operator' || (typeof cfg?.baseFontPt === 'number' && cfg.baseFontPt < 9);
    return { accentColor, layout, experienceStyle, headerStyle, fontFamily, compact };
  }, [selectedTemplateConfig, selectedTemplateSlug]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const name = `${(user?.user_metadata as any)?.first_name || ''} ${(user?.user_metadata as any)?.last_name || ''}`.trim();
        if (name) {
          setResume((prev) => ({ ...prev, contact: { ...(prev.contact || {}), name } }));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    setTargetTitle(preview.targetRole.primaryTitle || defaultResume.targetRole.primaryTitle || 'Head of Sales');
  }, [preview.targetRole.primaryTitle]);

  useEffect(() => {
    const industryFromPreview = (preview.targetRole.industry || [])[0] || (defaultResume.targetRole.industry || [])[0] || 'B2B';
    setSelectedIndustry(industryFromPreview);
  }, [preview.targetRole.industry]);

  useEffect(() => {
    const expList = preview.experience && preview.experience.length > 0 ? preview.experience : defaultResume.experience;
    const current = expList[activeExperienceIndex] || expList[0] || defaultResume.experience[0];
    setExpTitle(current?.title || '');
    setExpCompany(current?.company || '');
    setExpLocation(current?.location || '');
    setExpDates(current?.dates || '');
    setExpNotes(current?.whyHiredSummary || '');
    if (current?.bullets?.length) {
      setBulletSelections((prev) => {
        if (prev[activeExperienceIndex]) return prev;
        return {
          ...prev,
          [activeExperienceIndex]: current.bullets.map((b) => ({ text: b, selected: true })),
        };
      });
    }
  }, [activeExperienceIndex, preview.experience]);

  useEffect(() => {
    setSummaryText(preview.summary || '');
    setSkillsText((preview.skills || []).join(', '));
  }, [preview.summary, preview.skills]);

  const experienceList = useMemo(
    () => (preview.experience && preview.experience.length > 0 ? preview.experience : defaultResume.experience),
    [preview.experience]
  );
  const activeExperience = experienceList[activeExperienceIndex] || experienceList[0] || defaultResume.experience[0];
  const focusList = useMemo(
    () => (preview.targetRole.focus && preview.targetRole.focus.length > 0 ? preview.targetRole.focus : defaultResume.targetRole.focus || []),
    [preview.targetRole.focus]
  );
  const industries = useMemo(
    () =>
      preview.targetRole.industry && preview.targetRole.industry.length > 0
        ? preview.targetRole.industry
        : defaultResume.targetRole.industry || [],
    [preview.targetRole.industry]
  );

  const applyResumeJson = (payload: GeneratedResumeJson) => {
    const next = {
      targetRole: payload.targetRole || defaultResume.targetRole,
      summary: payload.summary || defaultResume.summary,
      skills: Array.isArray(payload.skills) && payload.skills.length > 0 ? payload.skills : defaultResume.skills,
      experience:
        Array.isArray(payload.experience) && payload.experience.length > 0 ? payload.experience : defaultResume.experience,
      contact: payload.contact || defaultResume.contact,
    };
    setResume(next);
    setDraft(next);
    setTargetTitle(next.targetRole.primaryTitle || defaultResume.targetRole.primaryTitle || 'Head of Sales');
    setSummaryText(next.summary || '');
    setSkillsText((next.skills || []).join(', '));
    const industryFromPreview = (next.targetRole.industry || [])[0] || (defaultResume.targetRole.industry || [])[0] || 'B2B';
    setSelectedIndustry(industryFromPreview);
    // Seed bullet selections
    const selections: Record<number, { text: string; selected: boolean }[]> = {};
    (next.experience || []).forEach((exp, idx) => {
      if (exp.bullets?.length) {
        selections[idx] = exp.bullets.map((b) => ({ text: b, selected: true }));
      }
    });
    setBulletSelections(selections);
  };

  const persistDraftJson = useCallback(
    async (nextDraft: GeneratedResumeJson) => {
      if (!draftId) return;
      try {
        const headers = await authHeaders();
        const res = await fetch(`${backend}/api/jobs/resume-drafts/${draftId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            generated_resume_json: nextDraft,
            template_slug: selectedTemplateSlug,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.warn('persist resume draft failed', data?.error || res.statusText);
        }
      } catch (e) {
        console.warn('persist resume draft failed', e);
      }
    },
    [backend, draftId, selectedTemplateSlug]
  );

  const parseJsonFromReply = (raw: any): GeneratedResumeJson | null => {
    try {
      if (typeof raw === 'string') {
        const stripped = raw.trim().replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, '$1');
        return JSON.parse(stripped);
      }
      if (raw?.text && typeof raw.text === 'string') {
        return JSON.parse(raw.text);
      }
      if (raw && typeof raw === 'object') return raw as GeneratedResumeJson;
    } catch {
      return null;
    }
    return null;
  };

  const generateStructuredResumeFromText = async (text: string): Promise<GeneratedResumeJson | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Sign in required');
      const headers = await authHeaders();
      const prompt = `Parse this resume into JSON with fields: targetRole.primaryTitle, targetRole.focus (array), targetRole.industry (array), summary, skills (array), experience (array of {company,title,location,dates,whyHiredSummary,bullets}). Return JSON only.\n\nResume:\n${text}`;
      const res = await fetch(`${backend}/api/rex/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: user.id,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to parse resume');
      const parsed = parseJsonFromReply(data?.reply?.content);
      return parsed;
    } catch (e) {
      console.error('parse resume failed', e);
      return null;
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setLoadError(null);
    try {
      const headers = await authHeaders({ includeJson: false });
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${backend}/api/rex/uploads`, { method: 'POST', headers, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      const text = data?.text || '';
      if (!text) {
        setLoadError('Could not extract text from file.');
      } else {
        setParsingUpload(true);
        const parsed = await generateStructuredResumeFromText(text);
        if (parsed) {
          applyResumeJson(parsed);
        } else {
          setResume((prev) => ({
            ...prev,
            summary: prev.summary || text.slice(0, 500),
          }));
        }
      }
    } catch (e: any) {
      setLoadError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setParsingUpload(false);
    }
  };

  const syncExperienceAt = (idx: number, updater: (exp: GeneratedExperience) => GeneratedExperience) => {
    const baseList = preview.experience && preview.experience.length > 0 ? preview.experience : defaultResume.experience;
    const nextList = baseList.map((exp, i) => (i === idx ? updater({ ...exp }) : exp));
    updateSection({ experience: nextList });
    setResume((prev) => ({ ...prev, experience: nextList }));
    persistDraftJson({ ...(preview as any), experience: nextList, contact: (preview as any)?.contact });
  };

  const moveExperience = (idx: number, dir: -1 | 1) => {
    const baseList = preview.experience && preview.experience.length > 0 ? preview.experience : defaultResume.experience;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= baseList.length) return;

    const nextList = [...baseList];
    [nextList[idx], nextList[nextIdx]] = [nextList[nextIdx], nextList[idx]];

    // Keep index-based UI state aligned with the moved role
    setViewBullets((prev) => {
      const copy = { ...prev };
      const a = !!copy[idx];
      const b = !!copy[nextIdx];
      copy[idx] = b;
      copy[nextIdx] = a;
      return copy;
    });
    setBulletSelections((prev) => {
      const copy: Record<number, { text: string; selected: boolean }[]> = { ...prev };
      const a = copy[idx];
      const b = copy[nextIdx];
      if (a !== undefined || b !== undefined) {
        if (b === undefined) delete copy[idx];
        else copy[idx] = b;
        if (a === undefined) delete copy[nextIdx];
        else copy[nextIdx] = a;
      }
      return copy;
    });
    setActiveExperienceIndex((prev) => {
      if (prev === idx) return nextIdx;
      if (prev === nextIdx) return idx;
      return prev;
    });

    updateSection({ experience: nextList });
    setResume((prev) => ({ ...prev, experience: nextList }));
    persistDraftJson({ ...(preview as any), experience: nextList, contact: (preview as any)?.contact });
  };

  const deleteExperience = (idx: number) => {
    const baseList = preview.experience && preview.experience.length > 0 ? preview.experience : defaultResume.experience;
    if (baseList.length <= 1) return;
    const exp = baseList[idx];
    const label = `${exp?.title || 'Role'}${exp?.company ? ` @ ${exp.company}` : ''}`.trim();
    const ok = window.confirm(`Delete this role?\n\n${label}`);
    if (!ok) return;

    const nextList = baseList.filter((_, i) => i !== idx);

    // Reindex index-based UI state to stay attached to the right role
    setViewBullets((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (Number.isNaN(i)) return;
        if (i === idx) return;
        next[i > idx ? i - 1 : i] = !!v;
      });
      return next;
    });
    setBulletSelections((prev) => {
      const next: Record<number, { text: string; selected: boolean }[]> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (Number.isNaN(i)) return;
        if (i === idx) return;
        next[i > idx ? i - 1 : i] = v || [];
      });
      return next;
    });
    setActiveExperienceIndex((prev) => {
      if (prev === idx) return Math.min(idx, nextList.length - 1);
      if (prev > idx) return prev - 1;
      return prev;
    });

    updateSection({ experience: nextList });
    setResume((prev) => ({ ...prev, experience: nextList }));
    persistDraftJson({ ...(preview as any), experience: nextList, contact: (preview as any)?.contact });
  };

  const addRoleManually = () => {
    const baseList = preview.experience && preview.experience.length > 0 ? preview.experience : defaultResume.experience;
    const nextList = [
      ...baseList,
      {
        company: '',
        title: '',
        location: '',
        dates: '',
        whyHiredSummary: '',
        bullets: [],
        included: true,
      } as GeneratedExperience,
    ];
    const newIdx = nextList.length - 1;
    updateSection({ experience: nextList });
    setResume((prev) => ({ ...prev, experience: nextList }));
    setActiveExperienceIndex(newIdx);
    setViewBullets((prev) => ({ ...prev, [newIdx]: false }));
    persistDraftJson({ ...(preview as any), experience: nextList, contact: (preview as any)?.contact });
  };

  const handleSelectExperience = (idx: number) => {
    setActiveExperienceIndex(idx);
  };

  const toggleViewBullets = (idx: number) => {
    setViewBullets((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleBulletToggle = (idx: number, bIndex: number) => {
    setBulletSelections((prev) => {
      const current = prev[idx] || [];
      const updated = current.map((b, i) => (i === bIndex ? { ...b, selected: !b.selected } : b));
      const next = { ...prev, [idx]: updated };
      const selectedBullets = updated.filter((b) => b.selected).map((b) => b.text);
      syncExperienceAt(idx, (exp) => ({ ...exp, bullets: selectedBullets }));
      return next;
    });
  };

  const addSelectedBulletsToPreview = (idx: number) => {
    const selected = (bulletSelections[idx] || []).filter((b) => b.selected).map((b) => b.text);
    syncExperienceAt(idx, (exp) => ({ ...exp, bullets: selected }));
  };

  const applyExperienceEdits = () => {
    const idx = activeExperienceIndex;
    syncExperienceAt(idx, (exp) => ({
      ...exp,
      title: expTitle,
      company: expCompany,
      location: expLocation,
      dates: expDates,
      whyHiredSummary: expNotes,
    }));
  };

  const generateBullets = async () => {
    const idx = activeExperienceIndex;
    setBulletsLoading(true);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Sign in required');
      const headers = await authHeaders();
      const prompt = `You are a resume bullet generator. Write 4 concise impact bullets for this role.\nTitle: ${expTitle}\nCompany: ${expCompany}\nDates: ${expDates}\nSummary/notes: ${expNotes}\nReturn bullets as plain text lines without numbering.`;
      const res = await fetch(`${backend}/api/rex/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: user.id,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate bullets');
      const raw = data?.reply?.content;
      const text =
        typeof raw === 'string'
          ? raw
          : typeof raw?.text === 'string'
            ? raw.text
            : Array.isArray(raw)
              ? raw.join('\n')
              : '';
      const parsed = text
        .split('\n')
        .map((l: string) => l.replace(/^[\-\*\u2022]\s*/, '').trim())
        .filter(Boolean);
      const bullets = parsed.length ? parsed : ['• Bullet 1', '• Bullet 2'];
      setBulletSelections((prev) => ({
        ...prev,
        [idx]: bullets.map((b) => ({ text: b, selected: true })),
      }));
      syncExperienceAt(idx, (exp) => ({ ...exp, bullets }));
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to generate bullets');
    } finally {
      setBulletsLoading(false);
    }
  };

  const saveSummary = () => {
    updateSection({ summary: summaryText });
    setResume((prev) => ({ ...prev, summary: summaryText }));
  };

  const saveSkills = () => {
    const parsed = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateSection({ skills: parsed });
    setResume((prev) => ({ ...prev, skills: parsed }));
  };

  const updateContact = (key: 'name' | 'email' | 'linkedin', value: string) => {
    const next = { ...(preview.contact || {}), [key]: value };
    updateSection({ contact: next });
    setResume((prev) => ({ ...prev, contact: next }));
  };

  const generateSummary = async () => {
    setSummaryLoading(true);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Sign in required');
      const headers = await authHeaders();
      const prompt = `Write a tight 3-sentence resume summary for this target: ${preview.targetRole.primaryTitle ||
        'Professional'}. Focus/industry: ${(preview.targetRole.focus || []).join(', ')} / ${(preview.targetRole.industry || []).join(', ')}.`;
      const res = await fetch(`${backend}/api/rex/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: user.id,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to write summary');
      const raw = data?.reply?.content;
      const text =
        typeof raw === 'string'
          ? raw.trim()
          : typeof raw?.text === 'string'
            ? raw.text.trim()
            : '';
      setSummaryText(text || summaryText);
      updateSection({ summary: text || summaryText });
      setResume((prev) => ({ ...prev, summary: text || summaryText }));
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to write summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const setIndustrySelection = (industry: string) => {
    setSelectedIndustry(industry);
    const next = { ...(preview.targetRole || {}), industry: [industry] };
    updateSection({ targetRole: next });
    setResume((prev) => ({ ...prev, targetRole: next }));
    markTargetRoleStep();
  };

  const addCustomIndustry = () => {
    const value = customIndustryText.trim();
    if (!value) return;
    setCustomIndustryOpen(false);
    setCustomIndustryText('');
    setIndustrySelection(value);
  };

  const applyTargetTitle = () => {
    const next = { ...(preview.targetRole || {}), primaryTitle: targetTitle || preview.targetRole.primaryTitle };
    updateSection({ targetRole: next });
    setResume((prev) => ({ ...prev, targetRole: next }));
    markTargetRoleStep();
  };

  const requestRoleStyle = async (style: string) => {
    setTargetStyle(style);
    setTargetLoading(style);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Sign in required');
      const headers = await authHeaders();
      const prompt = `You are a resume coach. Rewrite this resume target/primary title in a ${style} framing. Original: "${targetTitle ||
        preview.targetRole.primaryTitle ||
        'Head of Sales'}". Output only the rewritten title string, no quotes, no bullets.`;
      const res = await fetch(`${backend}/api/rex/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: user.id,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate title');
      const raw = data?.reply?.content;
      const newTitle =
        typeof raw === 'string' ? raw.trim() : typeof raw?.text === 'string' ? raw.text.trim() : (raw?.title || '').trim();
      if (!newTitle) throw new Error('No title generated');
      setTargetTitle(newTitle);
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to generate title');
    } finally {
      setTargetLoading(null);
    }
  };

  return (
    <div className="bg-[#020617] text-slate-100 font-sans antialiased">
      <div id="resume-builder-page" className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <header id="page-header" className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link
                to="/prep"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                <FaArrowLeft />
                <span>Back to Prep</span>
              </Link>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/70 border border-slate-800/80">
              <span className="text-xs text-slate-400">Target:</span>
              <span className="text-xs font-medium text-slate-200">
                {(preview.targetRole.primaryTitle || 'Head of Sales')} {industries.length ? `· ${industries.join(' / ')}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              <FaBrain className="text-indigo-400 text-xs" />
              <span className="text-xs text-indigo-300">Prep Center / Resume Builder</span>
            </div>
            {draftId && (
              <div className="px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                Prefilled from draft {draftId.slice(0, 8)}…
              </div>
            )}
            {loading && <div className="text-xs text-slate-400">Loading draft…</div>}
            {loadError && <div className="text-xs text-red-300">{loadError}</div>}
            <div className="flex items-center gap-2">
              <button
                onClick={() => uploadInputRef.current?.click()}
                className="text-xs px-3 py-1 rounded-full border border-slate-700 bg-slate-900/70 hover:border-sky-500 transition disabled:opacity-50"
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Upload resume'}
              </button>
              <button
                onClick={() => setShowExpanded(true)}
                className="text-xs px-3 py-1 rounded-full border border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500 transition"
              >
                Expand preview
              </button>
            </div>
          </div>

          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">Resume Builder</h1>
          <p className="text-slate-400 text-base">
            Generate a high-performing resume based on your target roles and experience.
          </p>
        </header>

        <div
          id="main-workspace"
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)] gap-6"
        >
          <div id="editor-panel" className="flex flex-col gap-6">
            {/* Target role */}
            <div
              id="target-role-section"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6"
            >
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-white mb-1">Target role</h2>
                <p className="text-xs text-slate-400">Tell REX what you&apos;re aiming for so your resume is aligned.</p>
              </div>

              <div className="space-y-4 mb-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-300">Primary title</label>
                    <button
                      onClick={applyTargetTitle}
                      className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
                    >
                      Add to resume
                    </button>
                  </div>
                  <input
                    type="text"
                    value={targetTitle}
                    onChange={(e) => setTargetTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Focus</label>
                  <div className="flex flex-wrap gap-2">
                    {focusList.map((focus, idx) => {
                      const active = focus === targetStyle;
                      return (
                        <button
                          key={`${focus}-${idx}`}
                          onClick={() => requestRoleStyle(focus)}
                          disabled={!!targetLoading}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            active
                              ? 'bg-indigo-500/30 border border-indigo-500/60 text-indigo-100'
                              : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-800'
                          } ${targetLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {targetLoading === focus ? 'Thinking…' : focus}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Industry</label>
                  <div className="flex flex-wrap gap-2">
                    {['B2B', 'SMB', 'SaaS', 'Energy', 'Healthcare', 'Insurance', 'Custom'].map((industry) => {
                      const active = selectedIndustry === industry;
                      const isCustom = industry === 'Custom';
                      return (
                        <button
                          key={industry}
                          onClick={() => {
                            if (isCustom) {
                              setCustomIndustryOpen(true);
                            } else {
                              setCustomIndustryOpen(false);
                              setIndustrySelection(industry);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            active
                              ? 'bg-indigo-500/30 border border-indigo-500/60 text-indigo-100'
                              : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {industry}
                        </button>
                      );
                    })}
                  </div>
                  {customIndustryOpen && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                      <p className="text-xs text-slate-300">Add your industry</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customIndustryText}
                          onChange={(e) => setCustomIndustryText(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                          placeholder="e.g., Climate Tech"
                        />
                        <button
                          className="px-3 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition disabled:opacity-60"
                          onClick={addCustomIndustry}
                          disabled={!customIndustryText.trim()}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Your name</label>
                    <input
                      type="text"
                      value={preview.contact?.name || ''}
                      onChange={(e) => updateContact('name', e.target.value)}
                      placeholder="Your name"
                      className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={preview.contact?.email || ''}
                      onChange={(e) => updateContact('email', e.target.value)}
                      placeholder="you@email.com"
                      className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">LinkedIn</label>
                    <input
                      type="text"
                      value={preview.contact?.linkedin || ''}
                      onChange={(e) => updateContact('linkedin', e.target.value)}
                      placeholder="linkedin.com/in/username"
                      className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 mb-4">
                <FaLightbulb className="text-indigo-400 text-sm mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-slate-300">
                    Tip: Be specific. &apos;Head of Sales for mid-market B2B SaaS&apos; is better than just &apos;Sales Leader&apos;.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  className="px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-60"
                  onClick={() => requestRoleStyle(targetStyle)}
                  disabled={!!targetLoading}
                >
                  <FaBrain className="text-xs" />
                  {targetLoading ? 'Refining…' : 'Ask REX to refine target'}
                </button>
              </div>
            </div>

            {/* Experience */}
            <div
              id="experience-section"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6"
            >
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-white mb-1">Experience</h2>
                <p className="text-xs text-slate-400">Select roles to highlight and let REX craft the bullets.</p>
              </div>

              <div className="space-y-3 mb-6">
                {experienceList.map((exp, idx) => {
                  const included = exp.included !== false;
                  const isActive = idx === activeExperienceIndex;
                  return (
                    <div
                      key={`${exp.company}-${idx}`}
                      className={`p-4 rounded-xl bg-slate-950/50 border ${
                        isActive
                          ? 'border-indigo-500/60 shadow-[0_0_0_1px_rgba(129,140,248,0.35)]'
                          : included
                            ? 'border-indigo-500/30 hover:border-indigo-500/50'
                            : 'border-slate-800 hover:border-slate-700'
                      } transition-all cursor-pointer`}
                      onClick={() => handleSelectExperience(idx)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-white">{exp.title || 'Role'}</h3>
                          <p className="text-xs text-slate-400">{exp.company || 'Company'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              title="Move up"
                              disabled={idx === 0}
                              className={`w-7 h-7 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center transition-all ${
                                idx === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveExperience(idx, -1);
                              }}
                            >
                              <FaChevronUp className="text-xs text-slate-300" />
                            </button>
                            <button
                              title="Move down"
                              disabled={idx === experienceList.length - 1}
                              className={`w-7 h-7 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center transition-all ${
                                idx === experienceList.length - 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveExperience(idx, 1);
                              }}
                            >
                              <FaChevronDown className="text-xs text-slate-300" />
                            </button>
                          </div>
                          <button
                            title={experienceList.length <= 1 ? 'Cannot delete the last role' : 'Delete role'}
                            disabled={experienceList.length <= 1}
                            className={`w-7 h-7 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center transition-all ${
                              experienceList.length <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-red-950/40 hover:border-red-800/60'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteExperience(idx);
                            }}
                          >
                            <FaTrash className={`text-xs ${experienceList.length <= 1 ? 'text-slate-500' : 'text-red-300'}`} />
                          </button>
                          <button
                            className="w-7 h-7 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectExperience(idx);
                            }}
                          >
                            <FaPen className="text-xs text-slate-400" />
                          </button>
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                              included
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                : 'bg-slate-800/50 border border-slate-700 text-slate-400'
                            }`}
                          >
                            {included ? 'Included' : 'Excluded'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{exp.dates || 'Dates TBD'}</span>
                        <button
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleViewBullets(idx);
                          }}
                        >
                          {viewBullets[idx] ? 'Hide bullets' : 'View bullets'}
                        </button>
                      </div>
                      {viewBullets[idx] && (
                        <div className="mt-3 space-y-1">
                          {(exp.bullets || []).map((b, i) => (
                            <p key={`${b}-${i}`} className="text-[11px] text-slate-400">
                              • {b}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                className="w-full py-2.5 rounded-lg border-2 border-dashed border-slate-700 text-slate-400 text-sm font-medium hover:border-slate-600 hover:text-slate-300 transition-all flex items-center justify-center gap-2"
                onClick={addRoleManually}
              >
                <FaPlus className="text-xs" />
                Add role manually
              </button>

              <div className="mt-6 pt-6 border-t border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-4">Active role editor</h3>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                    <input
                      type="text"
                      value={expTitle}
                      onChange={(e) => setExpTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Company</label>
                    <input
                      type="text"
                      value={expCompany}
                      onChange={(e) => setExpCompany(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Location</label>
                    <input
                      type="text"
                      value={expLocation}
                      onChange={(e) => setExpLocation(e.target.value)}
                      placeholder="San Francisco, CA"
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Dates</label>
                    <input
                      type="text"
                      value={expDates}
                      onChange={(e) => setExpDates(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Raw achievements / notes</label>
                  <textarea
                    rows={4}
                    value={expNotes}
                    onChange={(e) => setExpNotes(e.target.value)}
                    placeholder="Paste your achievements, metrics, or notes here..."
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                  />
                </div>

                <div className="flex gap-2 mb-3">
                  <button
                    className="px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-all"
                    onClick={applyExperienceEdits}
                  >
                    Save changes
                  </button>
                  <button
                    className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    onClick={generateBullets}
                    disabled={bulletsLoading}
                  >
                    <FaBrain className="text-xs" />
                    {bulletsLoading ? 'Generating…' : 'Generate bullets with REX'}
                  </button>
                </div>

                <div className="flex justify-end mb-2">
                  <button
                    className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
                    onClick={() => addSelectedBulletsToPreview(activeExperienceIndex)}
                  >
                    Add selected to preview
                  </button>
                </div>

                <div className="space-y-2">
                  {(bulletSelections[activeExperienceIndex] || []).map((bullet, idx) => (
                    <div key={`${bullet.text}-${idx}`} className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                      <input
                        type="checkbox"
                        checked={bullet.selected}
                        onChange={() => handleBulletToggle(activeExperienceIndex, idx)}
                        className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50"
                      />
                      <p className="text-xs text-slate-300 leading-relaxed">{bullet.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary & skills */}
            <div
              id="summary-skills-section"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6"
            >
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-white mb-1">Summary &amp; skills</h2>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-300 mb-2">Summary</label>
                <textarea
                  rows={4}
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                  placeholder="2–3 lines summarizing who you are, your core value, and what you're looking for."
                  className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-60"
                    onClick={generateSummary}
                    disabled={summaryLoading}
                  >
                    <FaBrain className="text-xs" />
                    {summaryLoading ? 'Writing…' : 'Ask REX to write summary'}
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-all"
                    onClick={saveSummary}
                  >
                    Save to preview
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Skills</label>
                <textarea
                  rows={2}
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="Comma-separated skills"
                  className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-all"
                    onClick={saveSkills}
                  >
                    Save skills to preview
                  </button>
                </div>
              </div>
            </div>

            <div id="rex-tip-panel" className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <FaBrain className="text-indigo-400 text-sm" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-semibold text-white mb-1">REX tip</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                    Lead with outcomes, not responsibilities. Start bullets with verbs + metrics.
                  </p>
                  <button className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors">
                    See example bullets →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Preview panel */}
          <div id="preview-panel" className="lg:sticky lg:top-6 h-fit">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-300">
                    Preview: {templateLoading ? 'Loading…' : selectedTemplateName}
                  </span>
                  <Link
                    to="/prep/resume/templates"
                    className="text-[11px] px-2 py-1 rounded-full border border-slate-800 bg-slate-900/50 text-slate-300 hover:border-indigo-500 hover:text-indigo-200 transition"
                    title="Choose a different template"
                  >
                    Change
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-900 transition-all flex items-center gap-2"
                  onClick={async () => {
                    await downloadPdf(backend, draftId || undefined);
                    await markResumeDownloaded();
                  }}
                >
                  <FaDownload className="text-xs" />
                  Download
                </button>
                <button
                  className="px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-900 transition-all flex items-center gap-2"
                  onClick={() => copyText()}
                >
                  <FaCopy className="text-xs" />
                  Copy text
                </button>
                  <button
                    className="px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-900 transition-all flex items-center gap-2"
                    onClick={() => setShowExpanded(true)}
                  >
                    Expand
                  </button>
                </div>
              </div>

              {(() => {
                const isTwoCol = previewTokens.layout === 'twoColumn';
                const isTimeline = previewTokens.experienceStyle === 'timeline';
                const isBrand = previewTokens.headerStyle === 'brand';
                const baseText = previewTokens.compact ? 'text-[11px]' : 'text-xs';
                const bodyText = previewTokens.compact ? 'text-[11px]' : 'text-xs';
                const headingText = previewTokens.compact ? 'text-[10px]' : 'text-xs';
                const accent = previewTokens.accentColor;
                const fontFamily = previewTokens.fontFamily;

                const SectionTitle = ({ children }: { children: React.ReactNode }) => (
                  <h2 className={`${headingText} font-bold tracking-wider uppercase mb-2`} style={{ color: accent }}>
                    {children}
                  </h2>
                );

                const SummarySection = () => (
                  <div className="mb-6">
                    <SectionTitle>Summary</SectionTitle>
                    <p className={`${previewTokens.compact ? 'text-[12px]' : 'text-sm'} text-slate-700 leading-relaxed`}>{preview.summary}</p>
                  </div>
                );

                const SkillsSection = () => (
                  <div>
                    <SectionTitle>Skills</SectionTitle>
                    <p className={`${bodyText} text-slate-700 leading-relaxed`}>{preview.skills.join(' · ')}</p>
                  </div>
                );

                const ExperienceSection = () => (
                  <div className="mb-6">
                    <SectionTitle>Experience</SectionTitle>
                    {experienceList.map((exp, idx) => {
                      const timelineWrap = isTimeline ? 'border-l-2 pl-3' : '';
                      const timelineStyle = isTimeline ? ({ borderColor: `${accent}55` } as React.CSSProperties) : undefined;
                      return (
                        <div className={`mb-4 ${timelineWrap}`} style={timelineStyle} key={`${exp.company}-${idx}`}>
                          <div className="flex justify-between items-start mb-1 gap-3">
                            <h3 className={`${previewTokens.compact ? 'text-[12px]' : 'text-sm'} font-bold text-slate-900`}>
                              {exp.title}
                            </h3>
                            <span className={`${baseText} text-slate-600 whitespace-nowrap`}>{exp.dates || ''}</span>
                          </div>
                          <p className={`${previewTokens.compact ? 'text-[12px]' : 'text-sm'} text-slate-700 font-medium mb-2`}>
                            {exp.company}
                          </p>
                          {exp.whyHiredSummary && <p className={`${bodyText} text-slate-700 leading-relaxed mb-2`}>{exp.whyHiredSummary}</p>}
                          {!!exp.bullets?.length && (
                            <ul className="space-y-1.5 ml-4">
                              {exp.bullets.map((b, i) => (
                                <li key={i} className={`${bodyText} text-slate-700 leading-relaxed list-disc`}>
                                  {b}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );

                return (
                  <div
                    id="resume-preview"
                    className="mx-auto aspect-[8.5/11] w-full max-w-xl rounded-xl bg-slate-50 text-slate-900 shadow-2xl overflow-y-auto"
                    style={{
                      maxHeight: '900px',
                      fontFamily: fontFamily || undefined,
                      padding: previewTokens.compact ? '1.5rem' : '2rem',
                    }}
                  >
                    {isBrand && <div style={{ height: 10, background: accent, margin: '-2rem -2rem 1rem -2rem' }} />}
                    <div className="mb-6 pb-4 border-b-2 border-slate-300">
                      <h1 className={`${previewTokens.compact ? 'text-2xl' : 'text-3xl'} font-bold text-slate-900 mb-1`}>
                        {preview.contact?.name || 'Your Name Here'}
                      </h1>
                      <p className={`${previewTokens.compact ? 'text-xs' : 'text-sm'} text-slate-700 font-medium mb-2`}>
                        {(preview.targetRole.primaryTitle || 'Role')} · {(focusList[0] || 'Focus')} · {(industries[0] || 'Industry')}
                      </p>
                      <div className={`flex items-center gap-3 ${baseText} text-slate-600`}>
                        <span>{preview.contact?.email || 'you@email.com'}</span>
                        <span>·</span>
                        <span>{preview.contact?.linkedin || 'linkedin.com/in/username'}</span>
                      </div>
                    </div>

                    {isTwoCol ? (
                      <div className="grid grid-cols-[1.65fr_1fr] gap-6">
                        <div>
                          <SummarySection />
                          <ExperienceSection />
                        </div>
                        <aside className="border-l border-slate-200 pl-4">
                          <SkillsSection />
                        </aside>
                      </div>
                    ) : (
                      <>
                        <SummarySection />
                        <ExperienceSection />
                        <SkillsSection />
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {showExpanded && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Expanded Resume Preview</h3>
              <button onClick={() => setShowExpanded(false)} className="text-slate-300 hover:text-white text-sm">
                Close
              </button>
            </div>
            <div
              className="bg-slate-50 text-slate-900 rounded-xl p-8 space-y-4"
              style={{ fontFamily: previewTokens.fontFamily || undefined }}
            >
              {previewTokens.headerStyle === 'brand' && (
                <div className="-mt-8 -mx-8 mb-4" style={{ height: 12, background: previewTokens.accentColor }} />
              )}
              <div className="mb-4 pb-3 border-b border-slate-200">
                <h1 className="text-3xl font-bold mb-1">{preview.contact?.name || 'Your Name Here'}</h1>
                <p className="text-sm text-slate-700 font-medium mb-2">
                  {(preview.targetRole.primaryTitle || 'Role')} · {(focusList[0] || 'Focus')} · {(industries[0] || 'Industry')}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-700">
                  <span>{preview.contact?.email || 'you@email.com'}</span>
                  <span>·</span>
                  <span>{preview.contact?.linkedin || 'linkedin.com/in/username'}</span>
                </div>
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wider uppercase mb-2" style={{ color: previewTokens.accentColor }}>
                  Summary
                </h2>
                <p className="text-sm leading-relaxed">{preview.summary}</p>
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wider uppercase mb-2" style={{ color: previewTokens.accentColor }}>
                  Experience
                </h2>
                <div className="space-y-3">
                  {experienceList.map((exp, idx) => (
                    <div
                      key={`${exp.company}-${idx}`}
                      className={previewTokens.experienceStyle === 'timeline' ? 'border-l-2 pl-3' : ''}
                      style={previewTokens.experienceStyle === 'timeline' ? ({ borderColor: `${previewTokens.accentColor}55` } as any) : undefined}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-sm font-bold">{exp.title}</h3>
                        <span className="text-xs text-slate-700">{exp.dates || ''}</span>
                      </div>
                      <p className="text-sm font-medium mb-1">{exp.company}</p>
                      {exp.whyHiredSummary && <p className="text-xs mb-2">{exp.whyHiredSummary}</p>}
                      {!!exp.bullets?.length && (
                        <ul className="space-y-1.5 ml-4">
                          {exp.bullets.map((b, i) => (
                            <li key={i} className="text-xs list-disc">
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wider uppercase mb-2" style={{ color: previewTokens.accentColor }}>
                  Skills
                </h2>
                <p className="text-xs leading-relaxed">{preview.skills.join(' · ')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={uploadInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = '';
        }}
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
      />

      {(uploading || parsingUpload) && (
        <UploadProgressOverlay
          title="Processing your resume…"
          message="Extracting text and prepping your preview. This can take ~15–30 seconds for larger files."
        />
      )}
    </div>
  );
}
