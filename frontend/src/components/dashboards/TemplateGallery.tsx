import React from 'react';
import type { DashboardTemplate } from '../../lib/dashboards/templates';

type Props = {
  templates: DashboardTemplate[];
  onSelect: (templateId: string) => void;
  onSelectCustom: () => void;
};

export default function TemplateGallery({ templates, onSelect, onSelectCustom }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-white text-xl font-semibold">Template Gallery</div>
          <div className="mt-1 text-sm text-white/50">
            Start with an executive-grade dashboard and map your table columns in under 2 minutes.
          </div>
        </div>
        <button
          onClick={onSelectCustom}
          className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm text-white/80"
        >
          Custom (Advanced)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => onSelect(tpl.id)}
            className="text-left rounded-xl border border-white/10 bg-zinc-950/60 hover:bg-zinc-950/80 transition px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-white font-semibold truncate">{tpl.name}</div>
                <div className="mt-1 text-sm text-white/50">{tpl.description}</div>
              </div>
              <div className="shrink-0 text-white/40">
                <i className="fa-solid fa-wand-magic-sparkles" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {tpl.requirements
                .filter((r) => r.required)
                .slice(0, 4)
                .map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center rounded-full bg-white/5 px-2 py-1 text-xs text-white/60 border border-white/10"
                  >
                    {r.label}
                  </span>
                ))}
              <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-1 text-xs text-white/60 border border-white/10">
                Map columns →
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


