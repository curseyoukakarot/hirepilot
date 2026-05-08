/**
 * v2 — FilterPill
 * Standard pill toggle used across pages with exclusive (radio-style)
 * filter strips: Goals, Leads, Pipelines, Deals, HireCatalog, Inbox.
 */

import React from 'react';

export interface FilterPillProps {
  label: React.ReactNode;
  active: boolean;
  onClick: () => void;
  /** Optional small count chip to the right of the label. */
  count?: number;
}

export default function FilterPill({ label, active, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11.5px] font-semibold transition ${
        active
          ? 'bg-primary text-white'
          : 'bg-white border border-gray-200 text-text-secondary hover:border-primary/30'
      }`}
    >
      {label}
    </button>
  );
}
