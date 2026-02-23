import React from 'react';

export default function TaskActivityFeed({ activity, highlightedActivityId }) {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center justify-between">
        Activity
        <span className="text-xs font-normal text-gray-400">Only visible to team</span>
      </h3>

      <div className="relative pl-4 border-l-2 border-gray-200 space-y-6">
        {activity.map((item) => {
          if (item.type === 'system') {
            return (
              <div className="relative" key={item.id} id={`task-activity-${item.id}`}>
                <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full border-2 border-white bg-gray-300" />
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-gray-600">{item.author}</span>
                    <span className="text-[10px] text-gray-400">{item.at}</span>
                  </div>
                  <p className="text-xs text-gray-500">{item.body}</p>
                </div>
              </div>
            );
          }

          return (
            <div className="relative" key={item.id} id={`task-activity-${item.id}`}>
              <div className="absolute -left-[25px] top-0">
                <img src={item.avatar} className="w-5 h-5 rounded-full ring-2 ring-white" alt={item.author} />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-700">{item.author}</span>
                  <span className="text-[10px] text-gray-400">{item.at}</span>
                </div>
                <div
                  className={
                    item.type === 'comment-primary'
                      ? `bg-indigo-50 p-3 rounded-lg rounded-tl-none border text-sm text-gray-800 ${
                          item.highlighted || String(item.id) === String(highlightedActivityId)
                            ? 'border-amber-400 ring-1 ring-amber-300/70'
                            : 'border-indigo-200'
                        }`
                      : `bg-gray-50 p-3 rounded-lg rounded-tl-none border text-sm text-gray-700 ${
                          item.highlighted || String(item.id) === String(highlightedActivityId)
                            ? 'border-amber-400 ring-1 ring-amber-300/70'
                            : 'border-gray-200'
                        }`
                  }
                >
                  <p>{item.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
