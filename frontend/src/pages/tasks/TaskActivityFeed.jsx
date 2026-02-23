import React from 'react';

export default function TaskActivityFeed({ activity, highlightedActivityId }) {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
        Activity
        <span className="text-xs font-normal text-gray-500">Only visible to team</span>
      </h3>

      <div className="relative pl-4 border-l-2 border-gray-800 space-y-6">
        {activity.map((item) => {
          if (item.type === 'system') {
            return (
              <div className="relative" key={item.id} id={`task-activity-${item.id}`}>
                <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full border-2 border-dark-300 bg-gray-600" />
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-gray-300">{item.author}</span>
                    <span className="text-[10px] text-gray-500">{item.at}</span>
                  </div>
                  <p className="text-xs text-gray-500">{item.body}</p>
                </div>
              </div>
            );
          }

          return (
            <div className="relative" key={item.id} id={`task-activity-${item.id}`}>
              <div className="absolute -left-[25px] top-0">
                <img src={item.avatar} className="w-5 h-5 rounded-full ring-2 ring-dark-300" alt={item.author} />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-300">{item.author}</span>
                  <span className="text-[10px] text-gray-500">{item.at}</span>
                </div>
                <div
                  className={
                    item.type === 'comment-primary'
                      ? `bg-primary-600/20 p-3 rounded-lg rounded-tl-none border text-sm text-gray-200 shadow-sm ${
                          item.highlighted || String(item.id) === String(highlightedActivityId)
                            ? 'border-yellow-400 ring-1 ring-yellow-300/70'
                            : 'border-primary-500/30'
                        }`
                      : `bg-dark-200 p-3 rounded-lg rounded-tl-none border text-sm text-gray-300 shadow-sm ${
                          item.highlighted || String(item.id) === String(highlightedActivityId)
                            ? 'border-yellow-400 ring-1 ring-yellow-300/70'
                            : 'border-gray-800'
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
