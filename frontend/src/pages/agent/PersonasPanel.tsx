import React, { useMemo } from 'react';

type Persona = {
  id: string;
  name: string;
  role: string;
  description?: string;
  location?: string;
  leadStats?: string;
};

export default function PersonasPanel(props: {
  onUseInScheduler?: (persona: Persona) => void;
  onCreatePersona?: () => void;
}) {
  const personas: Persona[] = useMemo(() => ([
    { id: 'p-recruiter', name: 'Recruiter Pro', role: 'Recruiter', description: 'Friendly, concise, prioritizes speed to outreach.', location: 'Remote • US', leadStats: '247 leads sourced • 2 days ago' },
    { id: 'p-sourcer', name: 'Sourcing Specialist', role: 'Sourcer', description: 'Disciplined sourcing prompts, structured filters.', location: 'Austin, TX', leadStats: '132 leads sourced • 1 day ago' },
    { id: 'p-sales', name: 'Sales SDR', role: 'Sales', description: 'Conversational tone, meeting-first CTA.', location: 'NYC, NY', leadStats: '89 leads sourced • 5 hours ago' }
  ]), []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Persona Card 1 */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:shadow-xl hover:shadow-primary/10 transition-all hover:border-slate-600">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <i className="fa-solid fa-user-tie text-white" />
          </div>
          <button className="text-slate-500 hover:text-slate-300">
            <i className="fa-solid fa-ellipsis-h" />
          </button>
        </div>
        <h3 className="font-semibold text-white mb-3">SDR Specialists</h3>

        {/* Title/Keywords as pills */}
        <div className="flex flex-wrap gap-1 mb-3">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">Sales Development</span>
          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">BDR</span>
          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">Lead Gen</span>
        </div>

        {/* Location */}
        <div className="flex items-center text-sm text-slate-400 mb-4">
          <i className="fa-solid fa-location-dot w-4 mr-2" />
          <span>San Francisco, Austin, Remote</span>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-slate-400">247 leads sourced</span>
          <span className="text-slate-500">2 days ago</span>
        </div>

        {/* Divider and actions */}
        <div className="border-t border-slate-700 pt-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <a className="flex items-center justify-center px-3 py-2 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors" href="/rex-chat?personaId=p-recruiter">
              <i className="fa-solid fa-comments mr-2" />
              Use in Chat
            </a>
            <button className="flex items-center justify-center px-3 py-2 bg-secondary/20 text-secondary rounded-lg text-sm font-medium hover:bg-secondary/30 transition-colors" onClick={() => props.onUseInScheduler && props.onUseInScheduler({ id:'p-recruiter', name:'Recruiter Pro', role:'Recruiter', description:'', location:'', leadStats:'' })}>
              <i className="fa-solid fa-clock mr-2" />
              Use in Scheduler
            </button>
          </div>
          <div className="flex space-x-2">
            <button className="flex-1 px-3 py-2 border border-slate-600 rounded-lg text-sm hover:bg-slate-700 text-slate-300">
              <i className="fa-solid fa-edit mr-1" />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Persona Card 2 */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:shadow-xl hover:shadow-primary/10 transition-all hover:border-slate-600">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
            <i className="fa-solid fa-code text-white" />
          </div>
          <button className="text-slate-500 hover:text-slate-300">
            <i className="fa-solid fa-ellipsis-h" />
          </button>
        </div>
        <h3 className="font-semibold text-white mb-3">Full Stack Engineers</h3>

        <div className="flex flex-wrap gap-1 mb-3">
          <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">React</span>
          <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">Node.js</span>
          <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">Python</span>
        </div>

        <div className="flex items-center text-sm text-slate-400 mb-4">
          <i className="fa-solid fa-location-dot w-4 mr-2" />
          <span>New York, Seattle, Remote</span>
        </div>

        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-slate-400">89 leads sourced</span>
          <span className="text-slate-500">1 week ago</span>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <a className="flex items-center justify-center px-3 py-2 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors" href="/rex-chat?personaId=p-sourcer">
              <i className="fa-solid fa-comments mr-2" />
              Use in Chat
            </a>
            <button className="flex items-center justify-center px-3 py-2 bg-secondary/20 text-secondary rounded-lg text-sm font-medium hover:bg-secondary/30 transition-colors" onClick={() => props.onUseInScheduler && props.onUseInScheduler({ id:'p-sourcer', name:'Sourcing Specialist', role:'Sourcer', description:'', location:'', leadStats:'' })}>
              <i className="fa-solid fa-clock mr-2" />
              Use in Scheduler
            </button>
          </div>
          <div className="flex space-x-2">
            <button className="flex-1 px-3 py-2 border border-slate-600 rounded-lg text-sm hover:bg-slate-700 text-slate-300">
              <i className="fa-solid fa-edit mr-1" />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Empty State / Create New Card */}
      <div className="bg-slate-800 rounded-xl border-2 border-dashed border-slate-600 p-8 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-slate-700/50 transition-colors cursor-pointer" onClick={() => props.onCreatePersona && props.onCreatePersona()}>
        <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center mb-4">
          <i className="fa-solid fa-plus text-slate-400 text-xl" />
        </div>
        <h3 className="font-semibold text-white mb-2">No Personas Yet</h3>
        <p className="text-sm text-slate-400 mb-4">Create your first persona to define target profiles</p>
        <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          + Create Persona
        </button>
      </div>
    </div>
  );
}


