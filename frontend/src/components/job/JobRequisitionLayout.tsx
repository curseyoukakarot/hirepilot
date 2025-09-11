import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faShareAlt,
  faRobot,
  faEdit,
  faArchive,
  faCopy,
} from '@fortawesome/free-solid-svg-icons';

const tabs = ['overview', 'team', 'candidates', 'activity', 'pipeline'] as const;
type Tab = typeof tabs[number];

export default function JobRequisitionLayout() {
  const [active, setActive] = useState<Tab>('overview');
  const assignees = [
    { id: '1', name: 'Alice', avatar: 'https://ui-avatars.com/api/?name=Alice' },
    { id: '2', name: 'Bob', avatar: 'https://ui-avatars.com/api/?name=Bob' },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="text-gray-500 hover:text-gray-700">
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Job Title</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                  open
                </span>
                {['Engineering', 'Remote', 'Senior'].map((t) => (
                  <span key={t} className="text-sm text-gray-500">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2 mr-2">
              {assignees.map((a) => (
                <img
                  key={a.id}
                  src={a.avatar}
                  alt={a.name}
                  className="w-8 h-8 rounded-full border-2 border-white"
                />
              ))}
            </div>
            <button className="p-2 text-gray-600 hover:text-gray-800" aria-label="Share">
              <FontAwesomeIcon icon={faShareAlt} />
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-800" aria-label="REX">
              <FontAwesomeIcon icon={faRobot} />
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-800" aria-label="Edit">
              <FontAwesomeIcon icon={faEdit} />
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-800" aria-label="Archive">
              <FontAwesomeIcon icon={faArchive} />
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-800" aria-label="Clone">
              <FontAwesomeIcon icon={faCopy} />
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-6 flex gap-6">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={`py-4 px-1 text-sm font-medium border-b-2 -mb-px focus:outline-none ${
                active === t
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
