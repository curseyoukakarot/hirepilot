import React from 'react';

interface ActivityItem {
  id: string;
  text: string;
  time: string;
}

const mock: ActivityItem[] = [
  { id: '1', text: 'Alice updated the description', time: '2h ago' },
  { id: '2', text: 'Bob commented on the job', time: '1h ago' },
];

export default function ActivityFeed() {
  return (
    <ul className="space-y-4">
      {mock.map((a) => (
        <li key={a.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">{a.text}</p>
          <p className="text-xs text-gray-500 mt-1">{a.time}</p>
        </li>
      ))}
    </ul>
  );
}
