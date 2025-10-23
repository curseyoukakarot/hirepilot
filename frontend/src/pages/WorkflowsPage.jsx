import React, { useMemo, useState } from 'react';
import { workflowLibrary } from '../data/workflowLibrary';
import WorkflowRecipeModal from '../components/WorkflowRecipeModal';

export default function WorkflowsPage() {
  const [selected, setSelected] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return workflowLibrary;
    const q = query.toLowerCase();
    return workflowLibrary.filter(
      (w) => w.title.toLowerCase().includes(q) || (w.description || '').toLowerCase().includes(q)
    );
  }, [query]);

  const openRecipe = (wf) => {
    setSelected(wf);
    setIsOpen(true);
  };

  const closeRecipe = () => {
    setIsOpen(false);
    setTimeout(() => setSelected(null), 200);
  };

  const byCategory = useMemo(() => {
    const groups = {};
    filtered.forEach((w) => {
      const key = w.category || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(w);
    });
    return groups;
  }, [filtered]);

  const colorClasses = {
    indigo: 'bg-indigo-900 text-indigo-300',
    purple: 'bg-purple-900 text-purple-300',
    green: 'bg-green-900 text-green-300',
    teal: 'bg-teal-900 text-teal-300',
    red: 'bg-red-900 text-red-300',
    amber: 'bg-amber-900 text-amber-300',
  };

  const toFormulaString = (wf) => {
    if (wf?.recipeJSON) {
      try { return JSON.stringify(wf.recipeJSON, null, 2); } catch (_) {}
    }
    const obj = { name: wf.title, trigger: wf.trigger, actions: wf.actions };
    try { return JSON.stringify(obj, null, 2); } catch (_) { return String(obj); }
  };

  return (
    <div id="main-content" className="bg-slate-950 min-h-screen text-white">
      {/* Top Bar */}
      <header id="header" className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Workflows</h1>
          <div className="relative">
            <input
              type="text"
              placeholder="Search workflows..."
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pl-10 w-80 focus:outline-none focus:border-indigo-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
          </div>
        </div>
        <button className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 rounded-lg font-semibold hover:scale-105 transition">
          <i className="fa-solid fa-plus mr-2"></i>
          Add Workflow
        </button>
      </header>

      {/* Page Content */}
      <main id="workflows-main" className="p-8 space-y-8">
        {/* Header Hero */}
        <section id="header-hero" className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-2xl">
          <h1 className="text-3xl font-bold mb-2">Automate Everything.</h1>
          <p className="text-slate-100 mb-4 text-lg">Install or customize ready-made recruiting workflows — powered by REX.</p>
          <button className="px-6 py-3 bg-white text-indigo-700 font-semibold rounded-lg shadow hover:scale-105 transition">
            Explore Workflow Library
          </button>
        </section>

        {/* Connected Integrations */}
        <section id="integrations-status" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Your Connected Integrations</h2>
            <button className="text-indigo-400 hover:text-indigo-300 font-medium">
              Manage All <i className="fa-solid fa-arrow-right ml-1"></i>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-brands fa-slack text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">Slack</h4>
              <span className="text-xs mt-2 text-green-400">✅ Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-solid fa-bolt text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">Zapier</h4>
              <span className="text-xs mt-2 text-green-400">✅ Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-solid fa-envelope text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">SendGrid</h4>
              <span className="text-xs mt-2 text-red-400">⚠️ Not Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition">Connect</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-brands fa-stripe text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">Stripe</h4>
              <span className="text-xs mt-2 text-green-400">✅ Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-brands fa-linkedin text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">LinkedIn</h4>
              <span className="text-xs mt-2 text-red-400">⚠️ Not Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition">Connect</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-solid fa-calendar text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">Calendly</h4>
              <span className="text-xs mt-2 text-green-400">✅ Connected</span>
              <button className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
            </div>
          </div>
        </section>

        {/* Workflow Library */}
        <section id="workflow-library" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Workflow Recipes Library</h2>
          </div>

          {/* Category Filters (static UI for now) */}
          <div id="category-filters" className="flex gap-2 flex-wrap">
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium">All</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">Messaging</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">Pipeline</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">Billing</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">REX</button>
          </div>

          {/* Grouped by category */}
          {Object.keys(byCategory).map((group) => (
            <div key={group} className="space-y-4">
              <h3 className="text-xl font-semibold">{group}</h3>
              <div id="workflow-grid" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {byCategory[group]?.map((wf) => (
                  <div key={wf.id} className="bg-slate-900 rounded-xl p-6 hover:bg-slate-800 transition group">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold pr-2">{wf.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${colorClasses[wf.color] || 'bg-slate-800 text-slate-300'}`}>
                        <span className="mr-1">{wf.icon}</span>{wf.category}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">{wf.description}</p>
                    <div className="flex gap-2">
                      <button onClick={() => openRecipe({ title: wf.title, summary: wf.description, tools: [wf.category], setupTime: '', difficulty: '', formula: toFormulaString(wf), setupSteps: [] })} className="px-3 py-2 bg-indigo-500 rounded-lg text-xs font-semibold text-white hover:bg-indigo-400 transition">View Recipe</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>

      <WorkflowRecipeModal
        isOpen={isOpen}
        onClose={closeRecipe}
        title={selected?.title || ''}
        summary={selected?.summary || ''}
        tools={selected?.tools || []}
        setupTime={selected?.setupTime || ''}
        difficulty={selected?.difficulty || ''}
        formula={selected?.formula || ''}
        setupSteps={selected?.setupSteps || []}
      />
    </div>
  );
}


