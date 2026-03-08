import React from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export type MissionDef = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  color: string;          // e.g. 'bg-amber-500'
  status: 'implemented' | 'coming_soon';
  creditCost?: string;    // e.g. '5 credits' or '5 credits/request'
};

type Props = {
  mission: MissionDef;
  onClick: () => void;
};

export default function MissionCard({ mission, onClick }: Props) {
  const disabled = mission.status === 'coming_soon';

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cx(
        'group w-full text-left rounded-2xl border p-5 transition',
        'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:-translate-y-0.5 hover:bg-white hover:shadow-md dark:hover:bg-slate-900',
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cx(
            'inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm text-lg',
            mission.color,
          )}
        >
          {mission.emoji}
        </div>
        {disabled ? (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Coming soon
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
            Open &rarr;
          </span>
        )}
      </div>
      <h3 className="mt-4 text-base font-bold">{mission.title}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{mission.description}</p>
      {mission.creditCost && (
        <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          ⚡ {mission.creditCost}
        </span>
      )}
    </button>
  );
}
