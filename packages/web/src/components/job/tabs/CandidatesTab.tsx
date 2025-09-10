import React from 'react';

const stages = ['Applied', 'Screened', 'Interview', 'Offer'];

export default function CandidatesTab() {
  const candidates = stages.reduce<Record<string, { id: string; name: string }[]>>(
    (acc, stage) => {
      acc[stage] = [
        { id: stage + '1', name: stage + ' Candidate' },
        { id: stage + '2', name: stage + ' Person' },
      ];
      return acc;
    },
    {}
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {stages.map((stage) => (
        <div
          key={stage}
          className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col max-h-[70vh]"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">{stage}</h3>
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
              {candidates[stage].length}
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto">
            {candidates[stage].map((c) => (
              <div
                key={c.id}
                className="border rounded-lg p-3 flex items-center gap-3 hover:shadow"
              >
                <img
                  src={`https://ui-avatars.com/api/?name=${c.name}`}
                  className="w-8 h-8 rounded-full"
                  alt={c.name}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">{stage}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
