import * as React from "react";
import { CardShell } from "../shared/CardShell";

export type ProposalType = "exec_search" | "gtm_overlay" | "rpo" | "recruiting_ops" | "advisory";
export type PricingModel = "retainer" | "contingency" | "hourly" | "project";
export type ProposalTone = "confident" | "warm" | "direct" | "story_driven";

export type ProposalSetupValues = {
  proposalTitle: string;
  clientCompany: string;
  clientContact: string;
  clientEmail: string;
  proposalType: ProposalType;
  pricingModel: PricingModel;
  rolesHiringFor: string;
  timeline: string;
  includeSections: {
    overview: boolean;
    scope: boolean;
    process: boolean;
    pricing: boolean;
    caseStudies: boolean;
    terms: boolean;
    nextSteps: boolean;
  };
  sectionContent: {
    overview: string;
    scope: string;
    process: string;
    pricing: string;
    caseStudies: string;
    terms: string;
    nextSteps: string;
  };
  tones: ProposalTone[];
  calendly: string;
};

type Props = {
  values: ProposalSetupValues;
  onChange: (patch: Partial<ProposalSetupValues>) => void;
  onGenerate: () => void;
  generating?: boolean;
};

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[14px] font-semibold text-white/85">{children}</div>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] leading-relaxed text-white/45">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-4",
        "text-[16px] text-white/90 placeholder:text-white/35",
        "outline-none focus:border-white/20 focus:bg-white/[0.06]",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "min-h-[140px] w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3",
        "text-[16px] text-white/90 placeholder:text-white/35",
        "outline-none focus:border-white/20 focus:bg-white/[0.06]",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-4",
        "text-[16px] text-white/90 outline-none",
        "focus:border-white/20 focus:bg-white/[0.06]",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition",
        active ? "border-blue-400/30 bg-blue-500/20 text-white" : "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.06]",
      ].join(" ")}
    >
      {active ? <span className="text-[14px] leading-none">✓</span> : null}
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full rounded-2xl px-5 py-[14px] text-[16px] font-semibold",
        "bg-[#2F66FF] text-white shadow-[0_12px_30px_rgba(47,102,255,0.35)]",
        "transition hover:brightness-110 active:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed",
        "inline-flex items-center justify-center gap-2",
      ].join(" ")}
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/15">✨</span>
      {children}
    </button>
  );
}

const PROPOSAL_TYPES: { value: ProposalType; label: string }[] = [
  { value: "exec_search", label: "Executive Search" },
  { value: "gtm_overlay", label: "GTM Overlay" },
  { value: "rpo", label: "RPO / Embedded Recruiting" },
  { value: "recruiting_ops", label: "Recruiting Ops" },
  { value: "advisory", label: "Advisory" },
];

const PRICING_MODELS: { value: PricingModel; label: string }[] = [
  { value: "retainer", label: "Retainer" },
  { value: "contingency", label: "Contingency" },
  { value: "hourly", label: "Hourly" },
  { value: "project", label: "Project / Fixed fee" },
];

const TONES: { key: ProposalTone; label: string }[] = [
  { key: "confident", label: "Confident" },
  { key: "warm", label: "Warm" },
  { key: "direct", label: "Direct" },
  { key: "story_driven", label: "Story-driven" },
];

export function ProposalSetupCard({ values, onChange, onGenerate, generating }: Props) {
  const [editingSection, setEditingSection] = React.useState<keyof ProposalSetupValues["includeSections"] | null>(null);

  const toggleTone = (key: ProposalTone) => {
    const set = new Set(values.tones);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onChange({ tones: Array.from(set) });
  };

  const toggleSection = (key: keyof ProposalSetupValues["includeSections"]) => {
    const nextEnabled = !values.includeSections[key];
    onChange({
      includeSections: {
        ...values.includeSections,
        [key]: nextEnabled,
      },
    });
    // When enabling a section, open the editor immediately so the user can add copy.
    if (nextEnabled) setEditingSection(key);
  };

  const sectionLabel: Record<keyof ProposalSetupValues["includeSections"], string> = {
    overview: "Overview",
    scope: "Scope & Deliverables",
    process: "Process",
    pricing: "Pricing",
    caseStudies: "Case studies",
    terms: "Terms",
    nextSteps: "Next steps",
  };

  const updateSectionContent = (key: keyof ProposalSetupValues["includeSections"], text: string) => {
    onChange({
      sectionContent: {
        ...(values.sectionContent || ({} as any)),
        [key]: text,
      } as any,
    });
  };

  return (
    <>
      <CardShell
        title="Proposal setup"
        subtitle="Tell REX what you're proposing, who it's for, and what to include."
        footer={
          <div className="space-y-3">
            <Hint>
              These settings help REX generate a polished proposal layout (web page or PDF-ready HTML). You can always edit
              the content manually.
            </Hint>
            <PrimaryButton onClick={onGenerate} disabled={!!generating}>
              {generating ? "Generating..." : "Generate proposal with REX"}
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Proposal title</Label>
            <Input
              value={values.proposalTitle}
              onChange={(e) => onChange({ proposalTitle: e.target.value })}
              placeholder="Offr Group x Acme — Executive Search Proposal"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Client company</Label>
              <Input
                value={values.clientCompany}
                onChange={(e) => onChange({ clientCompany: e.target.value })}
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-2">
              <Label>Client contact</Label>
              <Input
                value={values.clientContact}
                onChange={(e) => onChange({ clientContact: e.target.value })}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Client email</Label>
              <Input
                value={values.clientEmail}
                onChange={(e) => onChange({ clientEmail: e.target.value })}
                placeholder="jane@acme.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Proposal type</Label>
              <Select value={values.proposalType} onChange={(e) => onChange({ proposalType: e.target.value as ProposalType })}>
                {PROPOSAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pricing model</Label>
              <Select value={values.pricingModel} onChange={(e) => onChange({ pricingModel: e.target.value as PricingModel })}>
                {PRICING_MODELS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Roles / scope focus</Label>
            <Input
              value={values.rolesHiringFor}
              onChange={(e) => onChange({ rolesHiringFor: e.target.value })}
              placeholder='Ex: "VP Sales + 2 AEs" or "Head of Product Marketing"'
            />
          </div>

          <div className="space-y-2">
            <Label>Timeline</Label>
            <Input
              value={values.timeline}
              onChange={(e) => onChange({ timeline: e.target.value })}
              placeholder='Ex: "Kickoff this week → 3–4 week shortlist"'
            />
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <div className="flex flex-wrap gap-3">
              {TONES.map((t) => (
                <Chip key={t.key} active={values.tones.includes(t.key)} onClick={() => toggleTone(t.key)}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sections to include</Label>
            <div className="flex flex-wrap gap-3">
              <Chip active={values.includeSections.overview} onClick={() => toggleSection("overview")}>
                Overview
              </Chip>
              <Chip active={values.includeSections.scope} onClick={() => toggleSection("scope")}>
                Scope & Deliverables
              </Chip>
              <Chip active={values.includeSections.process} onClick={() => toggleSection("process")}>
                Process
              </Chip>
              <Chip active={values.includeSections.pricing} onClick={() => toggleSection("pricing")}>
                Pricing
              </Chip>
              <Chip active={values.includeSections.caseStudies} onClick={() => toggleSection("caseStudies")}>
                Case studies
              </Chip>
              <Chip active={values.includeSections.terms} onClick={() => toggleSection("terms")}>
                Terms
              </Chip>
              <Chip active={values.includeSections.nextSteps} onClick={() => toggleSection("nextSteps")}>
                Next steps
              </Chip>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  const keys = Object.keys(values.includeSections || {}) as Array<keyof ProposalSetupValues["includeSections"]>;
                  const first = keys.find((k) => values.includeSections[k]);
                  if (first) setEditingSection(first);
                }}
                className="text-[12px] font-medium text-white/60 hover:text-white/80 transition"
              >
                Edit section content
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Calendly link</Label>
            <Input
              value={values.calendly}
              onChange={(e) => onChange({ calendly: e.target.value })}
              placeholder="https://calendly.com/offr-group/introductory-call"
            />
          </div>
        </div>
      </CardShell>

      {editingSection && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950/85 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <div className="text-[12px] text-white/55">Edit section</div>
                <div className="text-[18px] font-semibold text-white">{sectionLabel[editingSection]}</div>
              </div>
              <button
                type="button"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-white/80 hover:bg-white/[0.06] transition"
                onClick={() => setEditingSection(null)}
              >
                Done
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <Hint>
                Add copy for this section. This text will be injected into the proposal preview automatically. You can still
                override everything in the HTML editor.
              </Hint>
              <Textarea
                value={String((values.sectionContent as any)?.[editingSection] || '')}
                onChange={(e) => updateSectionContent(editingSection, e.target.value)}
                placeholder={`Write the ${sectionLabel[editingSection].toLowerCase()} section…`}
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-[12px] font-medium text-white/55 hover:text-white/80 transition"
                  onClick={() => updateSectionContent(editingSection, '')}
                >
                  Clear text
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-white/80 hover:bg-white/[0.06] transition"
                  onClick={() => setEditingSection(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



