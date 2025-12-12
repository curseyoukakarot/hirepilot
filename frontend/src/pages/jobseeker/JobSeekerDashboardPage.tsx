import React, { useEffect, useState } from 'react';
import {
  FaRocket,
  FaBell,
  FaBriefcase,
  FaEye,
  FaComments,
  FaClock,
  FaMagnifyingGlass,
  FaUserPen,
  FaFileLines,
  FaChartLine,
} from 'react-icons/fa6';

const placeholders = [
  'Find senior React dev roles at startups',
  'Help me message a CTO',
  'What should I say to this recruiter?',
  'Find hiring managers for product roles',
];

export default function JobSeekerDashboardPage() {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % placeholders.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value.trim();
      if (!value) return;
      try {
        sessionStorage.setItem('rexPrompt', value);
      } catch {}
      window.location.href = '/rex-chat?source=dashboard';
    }
  };

  return (
    <div className="bg-[#0f0f0f] text-gray-100 min-h-screen font-sans">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-[#1a1a1a]/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <FaRocket className="text-white text-sm" />
                </div>
                <span className="text-xl font-bold text-white">HirePilot</span>
              </div>
              <nav className="hidden md:flex items-center space-x-6">
                <a className="text-white font-medium">Dashboard</a>
                <a className="text-gray-400 hover:text-white transition-colors">Jobs</a>
                <a className="text-gray-400 hover:text-white transition-colors">Applications</a>
                <a className="text-gray-400 hover:text-white transition-colors">Messages</a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-white transition-colors">
                <FaBell />
              </button>
              <div className="w-8 h-8 rounded-full overflow-hidden">
                <img
                  src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Welcome back, Alex</h1>
              <p className="text-gray-400">Ready to accelerate your career journey?</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Today</div>
              <div className="text-lg font-semibold text-white">December 12, 2024</div>
            </div>
          </div>
        </section>

        {/* REX Quick Chat */}
        <section className="mb-12">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/10 bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm text-gray-400 font-medium">HirePilot AI Assistant</span>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-violet-400 font-mono font-semibold">$</span>
                  <span className="text-lg font-semibold text-white">REX</span>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  onKeyDown={handleKeyPress}
                  placeholder={placeholders[placeholderIndex]}
                  className="w-full bg-transparent border-none outline-none text-white text-lg placeholder-gray-500 py-3 pr-20"
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <span className="text-xs text-gray-500 bg-[#1a1a1a] px-2 py-1 rounded">Press Enter to chat →</span>
                </div>
              </div>
              <div className="text-white text-lg animate-pulse">|</div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick stats */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: <FaBriefcase className="text-blue-400" />, value: '24', label: 'Job Opportunities', delta: '+12% this week' },
                { icon: <FaEye className="text-green-400" />, value: '8', label: 'Job Outreach', delta: '+25% this week' },
                { icon: <FaComments className="text-violet-400" />, value: '3', label: 'Interviews', delta: 'This week' },
              ].map((item) => (
                <div key={item.label} className="bg-[#1a1a1a] rounded-xl p-6 border border-[#262626]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-slate-800/50 rounded-lg flex items-center justify-center">{item.icon}</div>
                    <span className="text-2xl font-bold text-white">{item.value}</span>
                  </div>
                  <h3 className="text-gray-400 text-sm">{item.label}</h3>
                  <p className="text-xs text-green-400 mt-1">{item.delta}</p>
                </div>
              ))}
            </section>

            {/* Recent Jobs */}
            <section className="bg-[#1a1a1a] rounded-xl p-6 border border-[#262626]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Recent Jobs</h2>
                <a className="text-violet-400 text-sm hover:text-violet-300">View all</a>
              </div>
              <div className="space-y-4">
                {[
                  { letter: 'S', bg: 'bg-blue-500', title: 'Senior React Developer', company: 'Stripe • San Francisco', status: 'Under Review', statusColor: 'text-yellow-400', time: '2 days ago' },
                  { letter: 'V', bg: 'bg-green-500', title: 'Frontend Engineer', company: 'Vercel • Remote', status: 'Interview', statusColor: 'text-green-400', time: '1 week ago' },
                  { letter: 'N', bg: 'bg-purple-500', title: 'Full Stack Developer', company: 'Notion • New York', status: 'Applied', statusColor: 'text-gray-400', time: '1 week ago' },
                ].map((job) => (
                  <div key={job.title} className="flex items-center space-x-4 p-4 bg-[#262626] rounded-lg">
                    <div className={`w-12 h-12 ${job.bg} rounded-lg flex items-center justify-center`}>
                      <span className="text-white font-bold">{job.letter}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium">{job.title}</h3>
                      <p className="text-gray-400 text-sm">{job.company}</p>
                    </div>
                    <div className="text-right">
                      <span className={`${job.statusColor} text-sm`}>{job.status}</span>
                      <p className="text-gray-500 text-xs">{job.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-8">
            {/* Upcoming Interviews */}
            <section className="bg-[#1a1a1a] rounded-xl p-6 border border-[#262626]">
              <h2 className="text-xl font-semibold text-white mb-6">Upcoming Interviews</h2>
              <div className="space-y-4">
                <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-medium">Technical Interview</h3>
                    <span className="text-xs text-violet-400 bg-violet-500/20 px-2 py-1 rounded">Tomorrow</span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">Vercel • Frontend Engineer</p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <FaClock />
                    <span>2:00 PM - 3:00 PM</span>
                  </div>
                </div>

                <div className="p-4 bg-[#262626] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-medium">Culture Fit</h3>
                    <span className="text-xs text-gray-400 bg-[#404040] px-2 py-1 rounded">Dec 15</span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">Notion • Full Stack Dev</p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <FaClock />
                    <span>10:00 AM - 11:00 AM</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="bg-[#1a1a1a] rounded-xl p-6 border border-[#262626]">
              <h2 className="text-xl font-semibold text-white mb-6">Quick Actions</h2>
              <div className="space-y-3">
                {[
                  { icon: <FaMagnifyingGlass className="text-blue-400" />, label: 'Browse Jobs' },
                  { icon: <FaUserPen className="text-green-400" />, label: 'Update Profile' },
                  { icon: <FaFileLines className="text-violet-400" />, label: 'Upload Resume' },
                  { icon: <FaChartLine className="text-orange-400" />, label: 'View Analytics' },
                ].map((action) => (
                  <button
                    key={action.label}
                    className="w-full text-left p-3 bg-[#262626] hover:bg-[#404040] rounded-lg transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {action.icon}
                      <span className="text-white">{action.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
