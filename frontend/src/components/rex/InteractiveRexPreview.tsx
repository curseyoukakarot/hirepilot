import React, { useState } from 'react';

const InteractiveRexPreview: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileConsoleOpen, setMobileConsoleOpen] = useState(false);

  const closeMobilePanels = () => {
    setMobileSidebarOpen(false);
    setMobileConsoleOpen(false);
  };

  const openMobileSidebar = () => {
    setMobileConsoleOpen(false);
    setMobileSidebarOpen(true);
  };

  const openMobileConsole = () => {
    setMobileSidebarOpen(false);
    setMobileConsoleOpen(true);
  };

  const sidebarContent = (
    <>
      <div id="sidebar-header" className="p-4 border-b border-dark-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
            <i className="fa-solid fa-robot text-white text-lg" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">REX</h1>
            <p className="text-xs text-gray-400">Agent Console</p>
          </div>
        </div>
        <button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2">
          <i className="fa-solid fa-plus" />
          New Conversation
        </button>
      </div>

      <div id="saved-agents" className="px-3 py-4 border-b border-dark-800">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-3">Saved Agents</h3>
        <div className="agent-item bg-dark-800 hover:bg-dark-700 rounded-lg p-3 mb-2 cursor-pointer transition-all duration-150 border border-transparent hover:border-purple-500/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-magnifying-glass text-purple-400 text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-medium text-white truncate">Talent Hunter</h4>
                <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              </div>
              <p className="text-xs text-gray-400">Last run: 2 hours ago</p>
            </div>
          </div>
        </div>
        <div className="agent-item bg-dark-800 hover:bg-dark-700 rounded-lg p-3 mb-2 cursor-pointer transition-all duration-150 border border-transparent hover:border-purple-500/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-chart-line text-blue-400 text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-medium text-white truncate">Pipeline Optimizer</h4>
                <span className="w-2 h-2 bg-gray-500 rounded-full flex-shrink-0" />
              </div>
              <p className="text-xs text-gray-400">Last run: 1 day ago</p>
            </div>
          </div>
        </div>
      </div>

      <div id="conversations" className="flex-1 overflow-y-auto px-3 py-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-3">Conversations</h3>
        <div className="conversation-item bg-dark-800/50 hover:bg-dark-800 rounded-lg p-3 mb-2 cursor-pointer transition-all duration-150 border border-transparent hover:border-purple-500/20">
          <div className="flex items-start justify-between mb-1">
            <h4 className="text-sm font-medium text-white truncate flex-1">Find Senior React Developers</h4>
            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded ml-2 flex-shrink-0">Active</span>
          </div>
          <p className="text-xs text-gray-400">Updated 5 min ago</p>
        </div>
      </div>

      <div id="sidebar-footer" className="p-3 border-t border-dark-800">
        <div className="flex items-center gap-3 p-2 hover:bg-dark-800 rounded-lg cursor-pointer transition-all duration-150">
          <img
            src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
            alt="User avatar"
            className="w-8 h-8 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Alex Chen</p>
            <p className="text-xs text-gray-400">Premium Plan</p>
          </div>
          <i className="fa-solid fa-ellipsis-vertical text-gray-400" />
        </div>
      </div>
    </>
  );

  const consoleContent = (
    <>
      <div id="console-header" className="h-16 border-b border-dark-800 flex items-center justify-between px-5 flex-shrink-0">
        <h2 className="text-sm font-semibold text-white">Agent Console</h2>
        <button
          className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150"
          onClick={closeMobilePanels}
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      <div id="console-tabs" className="border-b border-dark-800 flex">
        <button className="flex-1 px-4 py-3 text-sm font-medium text-white bg-dark-800 border-b-2 border-purple-500 transition-all duration-150">
          <i className="fa-solid fa-list-check mr-2" />
          Plan
        </button>
        <button className="flex-1 px-4 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-800/50 border-b-2 border-transparent transition-all duration-150">
          <i className="fa-solid fa-bolt mr-2" />
          Execution
        </button>
      </div>
      <div id="console-content" className="flex-1 overflow-y-auto p-5">
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Current Plan</h3>
            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">Executing</span>
          </div>
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
            <p className="text-xs text-gray-300 leading-relaxed mb-3">
              Find 50 senior React developers with TypeScript and Next.js experience, open to remote work in North America.
            </p>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-400">Steps: <span className="text-white font-semibold">7</span></span>
              <span className="text-gray-400">Tools: <span className="text-white font-semibold">5</span></span>
              <span className="text-gray-400">Credits: <span className="text-white font-semibold">~450</span></span>
            </div>
          </div>
        </div>
      </div>
      <div id="console-footer" className="border-t border-dark-800 p-4 flex-shrink-0">
        <div className="bg-dark-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">Workflow Status</span>
            <span className="text-xs text-purple-400 font-semibold">Step 2 of 7</span>
          </div>
          <div className="w-full bg-dark-700 rounded-full h-1.5 mb-2">
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full transition-all duration-300 w-[29%]" />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="w-full">
      <style>{`
        #rex-landing-preview ::-webkit-scrollbar { display: none; }
      `}</style>
      <div id="rex-landing-preview" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div
          id="rex-container"
          className="relative flex h-[820px] sm:h-[860px] lg:h-[900px] overflow-hidden rounded-2xl border border-dark-800 bg-dark-950 text-gray-100 font-sans antialiased"
        >
          {(mobileSidebarOpen || mobileConsoleOpen) && (
            <button
              type="button"
              aria-label="Close overlay"
              className="absolute inset-0 z-20 bg-black/50 lg:hidden"
              onClick={closeMobilePanels}
            />
          )}

          {mobileSidebarOpen && (
            <aside className="absolute inset-y-0 left-0 z-30 w-[280px] bg-dark-900 border-r border-dark-800 flex flex-col lg:hidden">
              <div className="p-3 border-b border-dark-800 flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Menu</span>
                <button className="p-2 text-gray-400 hover:text-white" onClick={closeMobilePanels}>
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              {sidebarContent}
            </aside>
          )}

          {mobileConsoleOpen && (
            <aside className="absolute inset-y-0 right-0 z-30 w-[90%] max-w-[420px] bg-dark-900 border-l border-dark-800 flex flex-col xl:hidden">
              {consoleContent}
            </aside>
          )}

          <aside id="sidebar" className="hidden lg:flex w-[280px] bg-dark-900 border-r border-dark-800 flex-col">
            {sidebarContent}
          </aside>

          <main id="chat-panel" className="flex-1 flex flex-col bg-dark-950 min-w-0">
            <header id="chat-header" className="h-16 border-b border-dark-800 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150"
                  onClick={openMobileSidebar}
                >
                  <i className="fa-solid fa-bars" />
                </button>
                <h2 className="text-base sm:text-lg font-semibold text-white truncate">Find Senior React Developers</h2>
                <span className="hidden sm:inline-flex px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150">
                  <i className="fa-solid fa-clock-rotate-left sm:mr-1.5" />
                  <span className="hidden sm:inline">History</span>
                </button>
                <button
                  className="xl:hidden p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150"
                  onClick={openMobileConsole}
                >
                  <i className="fa-solid fa-list-check" />
                </button>
              </div>
            </header>

            <div id="chat-messages" className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
              <div className="message-group mb-8">
                <div className="flex justify-end mb-4">
                  <div className="max-w-2xl bg-purple-600 text-white rounded-2xl rounded-tr-sm px-5 py-3 shadow-lg">
                    <p className="text-sm leading-relaxed">
                      I need to find 50 senior React developers with 5+ years experience, TypeScript skills, and experience with Next.js.
                    </p>
                  </div>
                </div>
              </div>

              <div className="message-group mb-8">
                <div className="flex gap-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <i className="fa-solid fa-robot text-white text-sm" />
                  </div>
                  <div className="flex-1 max-w-3xl">
                    <div className="bg-dark-900 border border-dark-800 rounded-2xl rounded-tl-sm shadow-xl">
                      <div className="px-5 py-4 border-b border-dark-800">
                        <div className="flex items-center gap-2 mb-3">
                          <i className="fa-solid fa-brain text-purple-400" />
                          <h3 className="text-sm font-semibold text-white">Here&apos;s how I plan to approach this</h3>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed mb-4">
                          I&apos;ll create a comprehensive talent sourcing workflow to find qualified React developers matching your criteria.
                        </p>
                        <div className="space-y-2.5">
                          {[
                            'Source candidates from LinkedIn + Indeed',
                            'Extract and enrich profiles',
                            'Score against job requirements',
                            'Store as leads in pipeline'
                          ].map((step, idx) => (
                            <div key={step} className="flex gap-3">
                              <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-semibold text-purple-400">{idx + 1}</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-gray-200 font-medium">{step}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="px-5 py-4 bg-dark-800/30">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <i className="fa-solid fa-coins text-amber-400" />
                            <span>Est. Credits: <span className="text-white font-semibold">~450</span></span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <i className="fa-solid fa-clock text-blue-400" />
                            <span>Est. Time: <span className="text-white font-semibold">~15 min</span></span>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-purple-500/20">
                            <i className="fa-solid fa-check mr-2" />
                            Approve Plan
                          </button>
                          <button className="px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium text-sm transition-all duration-200 border border-dark-600">
                            Edit Plan
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div id="chat-input-container" className="border-t border-dark-800 p-4 flex-shrink-0">
              <div className="max-w-4xl mx-auto">
                <div className="relative">
                  <textarea
                    placeholder="Ask REX to find candidates, create workflows, or automate your recruiting..."
                    className="w-full bg-dark-900 border border-dark-700 focus:border-purple-500 rounded-xl px-5 py-4 pr-24 text-sm text-white placeholder-gray-500 resize-none focus:outline-none transition-all duration-200 shadow-lg"
                    rows={3}
                  />
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-purple-500/20">
                      <i className="fa-solid fa-paper-plane" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside id="agent-console" className="hidden xl:flex w-[420px] bg-dark-900 border-l border-dark-800 flex-col">
            {consoleContent}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default InteractiveRexPreview;


