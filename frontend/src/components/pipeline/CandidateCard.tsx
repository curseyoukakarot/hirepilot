import React from 'react';

export interface CandidateItem {
  id: string;
  candidate_id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

interface CandidateCardProps {
  candidate: CandidateItem;
  onClick?: (candidate: CandidateItem) => void;
  rightAction?: React.ReactNode;
}

const fallbackAvatar = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`;

export default function CandidateCard({ candidate, onClick, rightAction }: CandidateCardProps) {
  const { name, email, avatar_url } = candidate;
  const avatar = avatar_url || fallbackAvatar(name);
  return (
    <div
      className="bg-white p-4 rounded-lg border border-gray-200 hover:border-purple-600 hover:shadow-[0_0_15px_rgba(124,58,237,0.15)] transition-all duration-200 cursor-pointer group"
      onClick={() => onClick && onClick(candidate)}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">{name}</p>
          {email && <p className="text-sm text-text-secondary truncate max-w-[200px]">{email}</p>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} className="w-10 h-10 rounded-full object-cover" alt={name} onError={(e) => {
          const el = e.currentTarget as HTMLImageElement;
          el.onerror = null;
          el.src = fallbackAvatar(name);
        }} />
      </div>
      <div className="mt-4 flex items-center justify-between text-text-tertiary">
        <span className="text-xs">Updated just now</span>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-accent-purple">
          {rightAction}
        </div>
      </div>
    </div>
  );
}


