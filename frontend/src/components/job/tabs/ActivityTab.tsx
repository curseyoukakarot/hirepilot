import React, { useState } from 'react';
import FilterBar from '../../common/FilterBar';
import ActivityFeed from '../ActivityFeed';

const FILTERS = ['Comments', 'Stage Moves', 'Invites', 'Uploads', 'REX'];

export default function ActivityTab() {
  const [active, setActive] = useState<string[]>([]);

  const toggle = (f: string) => {
    setActive((prev) =>
      prev.includes(f) ? prev.filter((p) => p !== f) : [...prev, f]
    );
  };

  return (
    <div>
      <FilterBar filters={FILTERS} active={active} onToggle={toggle} />
      <ActivityFeed />
    </div>
  );
}
