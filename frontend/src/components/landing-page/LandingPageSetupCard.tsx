import * as React from "react";
import { CardShell } from "../shared/CardShell";

export type LandingPageSectionKey = "about" | "experience" | "case_studies" | "testimonials" | "contact";
export type ToneKey = "confident" | "warm" | "direct" | "story_driven";

export type LandingPageSetupValues = {
  heroFocus: string;
  heroSubtext: string;
  rolePersona: string;
  tones: ToneKey[];
  name: string;
  email: string;
  calendly: string;
  sections: LandingPageSectionKey[];
};

type Props = {
  values: LandingPageSetupValues;
  onChange: (patch: Partial<LandingPageSetupValues>) => void;
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
        "min-h-[96px] w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3",
        "text-[16px] text-white/90 placeholder:text-white/35",
        "outline-none focus:border-white/20 focus:bg-white/[0.06]",
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

const TONES: { key: ToneKey; label: string }[] = [
  { key: "confident", label: "Confident" },
  { key: "warm", label: "Warm" },
  { key: "direct", label: "Direct" },
  { key: "story_driven", label: "Story-driven" },
];

const SECTIONS: { key: LandingPageSectionKey; label: string }[] = [
  { key: "about", label: "About" },
  { key: "experience", label: "Experience" },
  { key: "case_studies", label: "Case studies" },
  { key: "testimonials", label: "Testimonials" },
  { key: "contact", label: "Contact" },
];

export function LandingPageSetupCard({ values, onChange, onGenerate, generating }: Props) {
  const toggleTone = (key: ToneKey) => {
    const set = new Set(values.tones);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onChange({ tones: Array.from(set) });
  };

  const toggleSection = (key: LandingPageSectionKey) => {
    const set = new Set(values.sections);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onChange({ sections: Array.from(set) });
  };

  return (
    <CardShell
      title="Page setup"
      subtitle="Tell REX how to position you, and what to highlight."
      footer={
        <div className="space-y-3">
          <Hint>These settings help REX generate your base HTML. You can always edit the code manually.</Hint>
          <PrimaryButton onClick={onGenerate} disabled={!!generating}>
            {generating ? "Generating..." : "Generate base layout with REX"}
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Hero focus</Label>
          <Input
            value={values.heroFocus}
            onChange={(e) => onChange({ heroFocus: e.target.value })}
            placeholder="Revenue leader helping B2B SaaS teams scale…"
          />
        </div>

        <div className="space-y-2">
          <Label>Hero subtext</Label>
          <Textarea
            value={values.heroSubtext}
            onChange={(e) => onChange({ heroSubtext: e.target.value })}
            placeholder="Short 1–2 sentence summary of who you are and what you do."
          />
        </div>

        <div className="space-y-2">
          <Label>Role &amp; persona</Label>
          <Input
            value={values.rolePersona}
            onChange={(e) => onChange({ rolePersona: e.target.value })}
            placeholder="Head of Sales"
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

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={values.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Your Name" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={values.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="you@email.com" />
          </div>
          <div className="space-y-2">
            <Label>Calendly link</Label>
            <Input
              value={values.calendly}
              onChange={(e) => onChange({ calendly: e.target.value })}
              placeholder="https://calendly.com/..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sections to include</Label>
          <div className="flex flex-wrap gap-3">
            {SECTIONS.map((s) => (
              <Chip key={s.key} active={values.sections.includes(s.key)} onClick={() => toggleSection(s.key)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </CardShell>
  );
}


