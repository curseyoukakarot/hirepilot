import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const STATIC_HTML = `
<div id="repo-guardian-page" class="min-h-screen bg-dark-950 text-white font-sans">
  <!-- Header -->
  <header class="sticky top-0 z-40 bg-dark-950/95 backdrop-blur-sm border-b border-dark-800">
    <div class="px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-3">
            <i class="fa-solid fa-shield-halved text-2xl text-blue-400"></i>
            <div>
              <h1 class="text-xl font-semibold text-white">Repo Guardian</h1>
              <p class="text-sm text-dark-400">System Health & Integrity Control Center</p>
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <div class="flex items-center space-x-4 px-4 py-2 bg-dark-900 border border-dark-800 rounded-lg">
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span class="text-sm text-dark-300">Auto Checks: <span class="text-green-400">On</span></span>
              <span class="text-dark-600">·</span>
              <span class="text-sm text-dark-400">Every 2h</span>
            </div>
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span class="text-sm text-dark-300">Auto Fix: <span class="text-yellow-400">Off</span></span>
            </div>
            <div class="flex items-center space-x-2">
              <i class="fa-solid fa-bell text-green-400 text-xs"></i>
              <span class="text-sm text-dark-300">Alerts: <span class="text-green-400">On</span></span>
            </div>
            <div class="flex items-center space-x-2">
              <i class="fa-regular fa-clock text-blue-400 text-xs"></i>
              <span class="text-sm text-blue-400">Next: 19m</span>
            </div>
          </div>
          <button class="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors duration-200 flex items-center space-x-2">
            <i class="fa-solid fa-play text-sm"></i>
            <span>Run Full Check</span>
          </button>
          <button class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center space-x-2">
            <i class="fa-solid fa-cog text-sm"></i>
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Stats Cards -->
  <section class="px-6 py-6">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-dark-900 border border-dark-800 rounded-xl p-6 hover:border-dark-700 transition-colors duration-200">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-dark-400 text-sm">System Health</p>
            <p class="text-2xl font-bold text-green-400 mt-1">98.5%</p>
            <p class="text-dark-500 text-xs mt-1">Last 24h</p>
          </div>
          <div class="w-12 h-12 bg-green-400/10 rounded-lg flex items-center justify-center">
            <i class="fa-solid fa-heart-pulse text-green-400 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-dark-900 border border-dark-800 rounded-xl p-6 hover:border-dark-700 transition-colors duration-200">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-dark-400 text-sm">Open Errors</p>
            <p class="text-2xl font-bold text-red-400 mt-1">12</p>
            <p class="text-dark-500 text-xs mt-1">3 high priority</p>
          </div>
          <div class="w-12 h-12 bg-red-400/10 rounded-lg flex items-center justify-center">
            <i class="fa-solid fa-triangle-exclamation text-red-400 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-dark-900 border border-dark-800 rounded-xl p-6 hover:border-dark-700 transition-colors duration-200">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-dark-400 text-sm">Scenarios</p>
            <p class="text-2xl font-bold text-white mt-1">8/10</p>
            <p class="text-dark-500 text-xs mt-1">Passing</p>
          </div>
          <div class="w-12 h-12 bg-blue-400/10 rounded-lg flex items-center justify-center">
            <i class="fa-solid fa-flask text-blue-400 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-dark-900 border border-dark-800 rounded-xl p-6 hover:border-dark-700 transition-colors duration-200">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-dark-400 text-sm">Last Sweep</p>
            <p class="text-2xl font-bold text-yellow-400 mt-1">2h</p>
            <p class="text-dark-500 text-xs mt-1">ago</p>
          </div>
          <div class="w-12 h-12 bg-yellow-400/10 rounded-lg flex items-center justify-center">
            <i class="fa-solid fa-broom text-yellow-400 text-xl"></i>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Main Content Grid -->
  <section class="px-6 pb-6">
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <!-- Left Panel -->
      <div class="lg:col-span-3">
        <div class="bg-dark-900 border border-dark-800 rounded-xl overflow-hidden">
          <!-- Tabs -->
          <div class="border-b border-dark-800">
            <div class="flex">
              <button class="tab-btn active px-6 py-4 text-sm font-medium border-b-2 border-blue-400 text-blue-400" data-tab="health">
                <i class="fa-solid fa-heartbeat mr-2"></i>Health Checks
              </button>
              <button class="tab-btn px-6 py-4 text-sm font-medium text-dark-400 hover:text-white transition-colors" data-tab="errors">
                <i class="fa-solid fa-bug mr-2"></i>Error Queue
              </button>
              <button class="tab-btn px-6 py-4 text-sm font-medium text-dark-400 hover:text-white transition-colors" data-tab="scenarios">
                <i class="fa-solid fa-flask mr-2"></i>Scenarios
              </button>
              <button class="tab-btn px-6 py-4 text-sm font-medium text-dark-400 hover:text-white transition-colors" data-tab="sweeps">
                <i class="fa-solid fa-broom mr-2"></i>Integrity Sweeps
              </button>
            </div>
          </div>

          <!-- Tab Content -->
          <div class="h-[600px] overflow-y-auto">
            <!-- Health Checks Tab -->
            <div id="health-tab" class="tab-content p-6">
              <div class="space-y-4">
                <div class="health-check-item bg-dark-800 border border-dark-700 rounded-lg p-4 hover:border-dark-600 cursor-pointer transition-colors">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                      <div>
                        <p class="font-medium text-white flex items-center">Main Branch Check <span class="ml-2 px-2 py-0.5 bg-green-400/10 text-green-400 text-xs rounded-full border border-green-400/20">AUTO</span></p>
                        <p class="text-sm text-dark-400">Tests: Pass • Lint: Pass • Build: Pass</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-dark-400">2 min ago</p>
                      <p class="text-xs text-green-400">System</p>
                    </div>
                  </div>
                </div>
                <div class="health-check-item bg-dark-800 border border-dark-700 rounded-lg p-4 hover:border-dark-600 cursor-pointer transition-colors">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <div>
                        <p class="font-medium text-white flex items-center">Feature Branch Check <span class="ml-2 px-2 py-0.5 bg-blue-400/10 text-blue-400 text-xs rounded-full border border-blue-400/20">MANUAL</span></p>
                        <p class="text-sm text-dark-400">Tests: Pass • Lint: Warn • Build: Pass</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-dark-400">15 min ago</p>
                      <p class="text-xs text-blue-400">john@hirepilot.ai</p>
                    </div>
                  </div>
                </div>
                <div class="health-check-item bg-dark-800 border border-dark-700 rounded-lg p-4 hover:border-dark-600 cursor-pointer transition-colors">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-3 h-3 bg-red-400 rounded-full"></div>
                      <div>
                        <p class="font-medium text-white flex items-center">Deploy Branch Check <span class="ml-2 px-2 py-0.5 bg-purple-400/10 text-purple-400 text-xs rounded-full border border-purple-400/20">AI FIX</span></p>
                        <p class="text-sm text-dark-400">Tests: Fail • Lint: Pass • Build: Fail</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-dark-400">1 hour ago</p>
                      <p class="text-xs text-red-400">High</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Error Queue Tab -->
            <div id="errors-tab" class="tab-content p-6 hidden">
              <div class="space-y-4">
                <div class="error-item bg-dark-800 border border-dark-700 rounded-lg p-4 hover:border-dark-600 cursor-pointer transition-colors">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-3 h-3 bg-red-400 rounded-full"></div>
                      <div>
                        <p class="font-medium text-white">TypeError: Cannot read properties</p>
                        <p class="text-sm text-dark-400">15 occurrences • /api/candidates</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-red-400">Open</p>
                      <p class="text-xs text-dark-400">2h ago</p>
                    </div>
                  </div>
                </div>
                <div class="error-item bg-dark-800 border border-dark-700 rounded-lg p-4 hover:border-dark-600 cursor-pointer transition-colors">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <div>
                        <p class="font-medium text-white">Database connection timeout</p>
                        <p class="text-sm text-dark-400">8 occurrences • /api/leads</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-yellow-400">Fixing</p>
                      <p class="text-xs text-dark-400">4h ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Scenarios Tab -->
            <div id="scenarios-tab" class="tab-content p-6 hidden">
              <div class="space-y-4">
                <div class="scenario-item bg-dark-800 border border-dark-700 rounded-lg p-4 hover:border-dark-600 cursor-pointer transition-colors">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                      <div>
                        <p class="font-medium text-white">Plan & Gating - Free vs Pro</p>
                        <p class="text-sm text-dark-400">Plan permissions validation</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-green-400">Pass</p>
                      <p class="text-xs text-dark-400">30m ago</p>
                    </div>
                  </div>
                </div>
                <div class="scenario-item bg-dark-800 border border-dark-700 rounded-lg p-4 hover:border-dark-600 cursor-pointer transition-colors">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-3 h-3 bg-red-400 rounded-full"></div>
                      <div>
                        <p class="font-medium text-white">Teams Sharing</p>
                        <p class="text-sm text-dark-400">Multi-team data access</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-red-400">Fail</p>
                      <p class="text-xs text-dark-400">1h ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sweeps Tab -->
            <div id="sweeps-tab" class="tab-content p-6 hidden">
              <div class="space-y-4">
                <div class="sweep-item bg-dark-800 border border-dark-700 rounded-lg p-4 hover:border-dark-600 cursor-pointer transition-colors">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                      <div>
                        <p class="font-medium text-white">Orphaned Entities</p>
                        <p class="text-sm text-dark-400">Leads & candidates cleanup</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-green-400">Clean</p>
                      <p class="text-xs text-dark-400">2h ago</p>
                    </div>
                  </div>
                </div>
                <div class="sweep-item bg-dark-800 border border-dark-700 rounded-lg p-4 hover:border-dark-600 cursor-pointer transition-colors">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <div>
                        <p class="font-medium text-white">Data Consistency</p>
                        <p class="text-sm text-dark-400">Cross-reference validation</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-yellow-400">3 violations</p>
                      <p class="text-xs text-dark-400">4h ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Detail Panel -->
        <div class="bg-dark-900 border border-dark-800 rounded-xl">
          <div class="border-b border-dark-800 px-6 py-4">
            <h3 class="text-lg font-semibold text-white flex items-center">
              <i class="fa-solid fa-info-circle text-blue-400 mr-2"></i> Details
            </h3>
          </div>
          <div class="p-6 overflow-y-auto max-h-[360px] space-y-4">
            <div>
              <p class="text-sm font-medium text-dark-400">Health Check</p>
              <p class="text-white mt-1">Main Branch Check</p>
            </div>
            <div>
              <p class="text-sm font-medium text-dark-400">Status</p>
              <div class="flex items-center space-x-2 mt-1">
                <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                <span class="text-green-400 text-sm">All checks passed</span>
              </div>
            </div>
            <div>
              <p class="text-sm font-medium text-dark-400">Branch</p>
              <p class="text-white mt-1 font-mono text-sm">main</p>
            </div>
            <div>
              <p class="text-sm font-medium text-dark-400">Triggered By</p>
              <p class="text-white mt-1">System (Automated)</p>
            </div>
            <div>
              <p class="text-sm font-medium text-dark-400">Summary</p>
              <p class="text-dark-300 mt-1 text-sm">All tests passed successfully. Build completed without errors. Linting passed with no issues.</p>
            </div>

            <!-- Repair Actions -->
            <div class="mt-6 pt-6 border-t border-dark-800">
              <h4 class="text-sm font-semibold text-white mb-4 flex items-center">
                <i class="fa-solid fa-wrench text-purple-400 mr-2"></i> Repair Actions
              </h4>
              <div class="space-y-3">
                <div class="flex items-center justify-between p-3 bg-dark-800 rounded-lg border border-dark-700">
                  <div class="flex items-center space-x-2">
                    <i class="fa-solid fa-circle-check text-green-400 text-sm"></i>
                    <span class="text-sm text-dark-300">Patch Status:</span>
                    <span class="text-sm text-green-400 font-medium">No Issues</span>
                  </div>
                </div>
                <button class="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2">
                  <i class="fa-solid fa-wand-magic-sparkles text-sm"></i>
                  <span>Analyze & Propose Patch</span>
                </button>
                <div class="grid grid-cols-2 gap-3">
                  <button class="px-4 py-2.5 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 border border-dark-700">
                    <i class="fa-solid fa-code-branch text-sm"></i>
                    <span>Create PR</span>
                  </button>
                  <button class="px-4 py-2.5 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 border border-dark-700">
                    <i class="fa-solid fa-rotate-left text-sm"></i>
                    <span>Rollback</span>
                  </button>
                </div>
                <button class="w-full px-4 py-2.5 bg-dark-800 hover:bg-dark-700 text-dark-400 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 text-sm border border-dark-700">
                  <i class="fa-solid fa-history text-xs"></i>
                  <span>View Patch History</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Panel -->
        <div id="chat-panel" class="bg-dark-900 border border-dark-800 rounded-xl flex flex-col h-[300px]">
          <div class="border-b border-dark-800 px-6 py-4 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-white flex items-center">
              <i class="fa-solid fa-robot text-purple-400 mr-2"></i> Repo Agent Chat
            </h3>
            <div class="flex items-center space-x-3">
              <span class="text-xs text-dark-400">Mode:</span>
              <button id="chat-mode-toggle" class="relative inline-flex items-center h-6 rounded-full w-20 bg-dark-800 border border-dark-700 transition-colors duration-200">
                <span class="left-label absolute left-1 text-[10px] text-green-400 font-medium">Explain</span>
                <span class="right-label absolute right-1 text-[10px] text-dark-400 font-medium">Patch</span>
                <span id="chat-mode-slider" class="inline-block w-8 h-5 bg-blue-500 rounded-full transition-transform duration-200" style="transform: translateX(2px);"></span>
              </button>
            </div>
          </div>
          <div class="chat-messages flex-1 p-4 overflow-y-auto space-y-4">
            <div class="flex items-start space-x-3">
              <div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fa-solid fa-robot text-white text-sm"></i>
              </div>
              <div class="bg-dark-800 rounded-lg p-3 max-w-[80%]">
                <p class="text-sm text-white">Hello! I'm your Repo Agent. I can help you analyze system health, investigate errors, and provide insights about your codebase. What would you like to know?</p>
                <div class="mt-2 pt-2 border-t border-dark-700">
                  <p class="text-xs text-dark-400">
                    <i class="fa-solid fa-shield-halved mr-1"></i>
                    Currently in <span class="text-blue-400 font-medium">Explain Only</span> mode
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div class="border-t border-dark-800 p-4">
            <div class="flex space-x-3">
              <input type="text" class="chat-input flex-1 bg-dark-800 border border-dark-700 rounded-lg px-4 py-3 text-white placeholder-dark-400 focus:outline-none focus:border-blue-400 transition-colors" placeholder="Ask about errors, health checks, or system status..." />
              <button class="chat-send px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200">
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>
`;

const DARK_THEME_STYLES = `
#repo-guardian-page {
  background-color: #020617;
  color: #fff;
}
#repo-guardian-page .bg-dark-950 { background-color: #020617 !important; }
#repo-guardian-page .bg-dark-950\\/95 { background-color: rgba(2, 6, 23, 0.95) !important; }
#repo-guardian-page .bg-dark-950\\/90 { background-color: rgba(2, 6, 23, 0.9) !important; }
#repo-guardian-page .bg-dark-950\\/80 { background-color: rgba(2, 6, 23, 0.8) !important; }
#repo-guardian-page .bg-dark-950\\/60 { background-color: rgba(2, 6, 23, 0.6) !important; }
#repo-guardian-page .bg-dark-950\\/40 { background-color: rgba(2, 6, 23, 0.4) !important; }
#repo-guardian-page .bg-dark-900 { background-color: #0f172a !important; }
#repo-guardian-page .bg-dark-900\\/70 { background-color: rgba(15, 23, 42, 0.7) !important; }
#repo-guardian-page .bg-dark-900\\/60 { background-color: rgba(15, 23, 42, 0.6) !important; }
#repo-guardian-page .bg-dark-800 { background-color: #1e293b !important; }
#repo-guardian-page .bg-dark-800\\/90 { background-color: rgba(30, 41, 59, 0.9) !important; }
#repo-guardian-page .bg-dark-800\\/70 { background-color: rgba(30, 41, 59, 0.7) !important; }
#repo-guardian-page .bg-dark-800\\/60 { background-color: rgba(30, 41, 59, 0.6) !important; }
#repo-guardian-page .bg-dark-700 { background-color: #334155 !important; }
#repo-guardian-page .bg-dark-700\\/90 { background-color: rgba(51, 65, 85, 0.9) !important; }
#repo-guardian-page .border-dark-900 { border-color: #0f172a !important; }
#repo-guardian-page .border-dark-800 { border-color: #1e293b !important; }
#repo-guardian-page .border-dark-700 { border-color: #334155 !important; }
#repo-guardian-page .text-dark-300 { color: #cbd5e1 !important; }
#repo-guardian-page .text-dark-400 { color: #94a3b8 !important; }
#repo-guardian-page .text-dark-500 { color: #64748b !important; }
#repo-guardian-page .text-dark-600 { color: #475569 !important; }
#repo-guardian-page .text-dark-100 { color: #f1f5f9 !important; }
#repo-guardian-page .shadow-card {
  box-shadow: 0 20px 60px rgba(2, 6, 23, 0.55);
}
#repo-guardian-page .health-check-item,
#repo-guardian-page .error-item,
#repo-guardian-page .scenario-item,
#repo-guardian-page .sweep-item {
  background: #1e293b;
  border-color: #273247;
}
#repo-guardian-page .health-check-item:hover,
#repo-guardian-page .error-item:hover,
#repo-guardian-page .scenario-item:hover,
#repo-guardian-page .sweep-item:hover {
  border-color: #3e4a63;
}
#repo-guardian-page .chat-input {
  background: #0f172a;
  border-color: #1e2538;
  color: #f8fafc;
}
#repo-guardian-page .chat-input::placeholder {
  color: #64748b;
}
`;

const RepoGuardianPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const styleId = 'repo-guardian-dark-theme';
      if (!document.getElementById(styleId)) {
        const styleTag = document.createElement('style');
        styleTag.id = styleId;
        styleTag.innerHTML = DARK_THEME_STYLES;
        document.head.appendChild(styleTag);
      }
    }

    let isMounted = true;
    async function fetchRole() {
      try {
        const { data } = await supabase.auth.getUser();
        const role = data?.user?.app_metadata?.role;
        if (isMounted) {
          setIsAllowed(role === 'super_admin');
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setIsAllowed(false);
          setIsLoading(false);
        }
      }
    }
    fetchRole();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAllowed) return;
    const container = document.getElementById('repo-guardian-page');
    if (!container) return;

    const tabButtons = Array.from(container.querySelectorAll('.tab-btn'));
    const tabContents = Array.from(container.querySelectorAll('.tab-content'));

    const handleTabClick = function handleTabClick() {
      const tabName = this.getAttribute('data-tab');
      tabButtons.forEach((btn) => {
        btn.classList.remove('active', 'text-blue-400', 'border-blue-400');
        btn.classList.add('text-dark-400');
        btn.style.borderBottomColor = 'transparent';
      });
      this.classList.add('active', 'text-blue-400');
      this.classList.remove('text-dark-400');
      this.style.borderBottomColor = '#60a5fa';
      tabContents.forEach((content) => content.classList.add('hidden'));
      const activeTab = container.querySelector(`#${tabName}-tab`);
      if (activeTab) activeTab.classList.remove('hidden');
    };

    tabButtons.forEach((btn) => btn.addEventListener('click', handleTabClick));

    const selectableItems = Array.from(
      container.querySelectorAll('.health-check-item, .error-item, .scenario-item, .sweep-item')
    );
    const handleSelect = function handleSelect() {
      selectableItems.forEach((item) => item.classList.remove('bg-dark-700', 'border-blue-500'));
      this.classList.add('bg-dark-700', 'border-blue-500');
    };
    selectableItems.forEach((item) => item.addEventListener('click', handleSelect));

    const chatPanel = container.querySelector('#chat-panel');
    const chatInput = chatPanel?.querySelector('.chat-input');
    const chatSendButton = chatPanel?.querySelector('.chat-send');
    const chatMessages = chatPanel?.querySelector('.chat-messages');

    const appendMessage = (content, type = 'user') => {
      if (!chatMessages) return;
      const wrapper = document.createElement('div');
      wrapper.className =
        type === 'user'
          ? 'flex items-start space-x-3 justify-end'
          : 'flex items-start space-x-3';
      wrapper.innerHTML =
        type === 'user'
          ? `
              <div class="bg-blue-600 rounded-lg p-3 max-w-[80%]">
                <p class="text-sm text-white">${content}</p>
              </div>
              <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <i class="fa-solid fa-user text-white text-sm"></i>
              </div>
            `
          : `
              <div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <i class="fa-solid fa-robot text-white text-sm"></i>
              </div>
              <div class="bg-dark-800 rounded-lg p-3 max-w-[80%]">
                <p class="text-sm text-white">${content}</p>
              </div>
            `;
      chatMessages.appendChild(wrapper);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const handleSend = () => {
      if (!chatInput || !chatInput.value.trim()) return;
      const message = chatInput.value.trim();
      appendMessage(message, 'user');
      chatInput.value = '';
      setTimeout(() => {
        appendMessage(`I understand you're asking about "${message}". Let me analyze the current system state and provide insights...`, 'agent');
      }, 800);
    };

    chatSendButton?.addEventListener('click', handleSend);
    const handleKeyPress = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSend();
      }
    };
    chatInput?.addEventListener('keypress', handleKeyPress);

    const chatModeToggle = container.querySelector('#chat-mode-toggle');
    const chatModeSlider = container.querySelector('#chat-mode-slider');
    const leftLabel = chatModeToggle?.querySelector('.left-label');
    const rightLabel = chatModeToggle?.querySelector('.right-label');
    let isPatchMode = false;
    const handleToggle = () => {
      isPatchMode = !isPatchMode;
      if (chatModeSlider) {
        chatModeSlider.style.transform = isPatchMode ? 'translateX(60px)' : 'translateX(2px)';
      }
      if (leftLabel && rightLabel) {
        if (isPatchMode) {
          leftLabel.classList.remove('text-green-400');
          leftLabel.classList.add('text-dark-400');
          rightLabel.classList.remove('text-dark-400');
          rightLabel.classList.add('text-green-400');
        } else {
          leftLabel.classList.add('text-green-400');
          leftLabel.classList.remove('text-dark-400');
          rightLabel.classList.add('text-dark-400');
          rightLabel.classList.remove('text-green-400');
        }
      }
    };
    chatModeToggle?.addEventListener('click', handleToggle);

    return () => {
      tabButtons.forEach((btn) => btn.removeEventListener('click', handleTabClick));
      selectableItems.forEach((item) => item.removeEventListener('click', handleSelect));
      chatSendButton?.removeEventListener('click', handleSend);
      chatInput?.removeEventListener('keypress', handleKeyPress);
      chatModeToggle?.removeEventListener('click', handleToggle);
    };
  }, [isAllowed]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-950 text-white">
        <p>Loading Repo Guardian…</p>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-dark-950 text-white text-center px-6">
        <h1 className="text-2xl font-semibold">Repo Guardian</h1>
        <p className="text-dark-400 mt-2">This area is restricted to Super Admins.</p>
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: STATIC_HTML }} />;
};

export default RepoGuardianPage;

