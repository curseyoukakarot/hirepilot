import React from 'react';

const InteractiveRexPreview: React.FC = () => {
  return (
    <div className="w-full">
      <style>{`
        /* Local styles for the interactive preview */
        .terminal-glow{box-shadow:0 0 20px rgba(34,197,94,.3),0 0 40px rgba(34,197,94,.1)}
        .message-fade-in{animation:fadeInUp .5s ease-out}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .dot-pulse{animation:dotPulse 1.5s infinite}
        @keyframes dotPulse{0%,20%{opacity:0}50%{opacity:1}80%,100%{opacity:0}}
      `}</style>
      <div className="max-w-7xl mx-auto px-6">
        <div id="main-container" className="min-h-[560px] md:min-h-[640px] flex border border-gray-800 rounded-2xl overflow-hidden bg-gray-900">
          {/* Sidebar */}
          <div id="sidebar" className="hidden md:flex w-64 bg-gray-800 border-r border-gray-700 flex-col">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-robot text-sm" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">HirePilot AI</h2>
                  <p className="text-xs text-gray-400">REX Assistant</p>
                </div>
              </div>
            </div>
            <div className="flex-1 p-4">
              <button className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition-colors mb-4">
                <div className="flex items-center space-x-3">
                  <i className="fa-solid fa-plus text-green-400" />
                  <span className="text-sm">New Chat</span>
                </div>
              </button>
              <div className="space-y-2">
                <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">Recent Chats</div>
                <div className="bg-gray-700/50 rounded-lg p-3 cursor-pointer hover:bg-gray-700 transition-colors">
                  <p className="text-sm truncate">React developers in SF</p>
                  <p className="text-xs text-gray-400">2 hours ago</p>
                </div>
                <div className="rounded-lg p-3 cursor-pointer hover:bg-gray-700 transition-colors">
                  <p className="text-sm truncate">Senior Python engineers</p>
                  <p className="text-xs text-gray-400">Yesterday</p>
                </div>
                <div className="rounded-lg p-3 cursor-pointer hover:bg-gray-700 transition-colors">
                  <p className="text-sm truncate">DevOps talent search</p>
                  <p className="text-xs text-gray-400">3 days ago</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-700">
              <div className="flex items-center space-x-3">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" className="w-8 h-8 rounded-full" />
                <div>
                  <p className="text-sm font-medium">David</p>
                  <p className="text-xs text-gray-400">Team Plan</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Chat Area */}
          <div id="chat-container" className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div id="chat-header" className="bg-gray-800 border-b border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold">HirePilot AI Assistant – REX</h1>
                    <p className="text-sm text-gray-400">Terminal v2.1.0</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                    <i className="fa-solid fa-gear text-gray-400" />
                  </button>
                  <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                    <i className="fa-solid fa-ellipsis-vertical text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div id="chat-messages" className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Welcome Message */}
              <div className="message-fade-in">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-robot text-sm" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-mono text-green-400 font-semibold">$ REX</span>
                      <span className="text-xs text-gray-400">System initialized</span>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 terminal-glow">
                      <p className="text-gray-300 mb-3">Hey there! 👋 I'm REX, your AI recruiting assistant.</p>
                      <p className="text-gray-300 mb-3">I can help you find, analyze, and connect with top talent across:</p>
                      <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                        <li>LinkedIn profiles & connections</li>
                        <li>Apollo database searches</li>
                        <li>GitHub developer insights</li>
                        <li>Market salary analysis</li>
                      </ul>
                      <p className="text-green-400 font-mono mt-4">Ready to find some amazing talent? 🚀</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Message */}
              <div className="message-fade-in">
                <div className="flex items-start space-x-4 justify-end">
                  <div className="flex-1 max-w-3xl">
                    <div className="flex items-center space-x-2 mb-2 justify-end">
                      <span className="text-xs text-gray-400">Just now</span>
                      <span className="font-medium">You</span>
                    </div>
                    <div className="bg-blue-600 rounded-lg p-4 text-white">
                      <p>Find me senior React developers in San Francisco.</p>
                    </div>
                  </div>
                  <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" className="w-8 h-8 rounded-full flex-shrink-0" />
                </div>
              </div>

              {/* REX Status Messages */}
              <div className="message-fade-in">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-robot text-sm" />
                  </div>
                  <div className="flex-1">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-green-400 font-semibold">$ REX</span>
                        <span className="text-gray-300 font-mono">Initiating search...</span>
                        <div className="flex space-x-1">
                          <span className="dot-pulse">.</span>
                          <span className="dot-pulse" style={{animationDelay: '.2s'}}>.</span>
                          <span className="dot-pulse" style={{animationDelay: '.4s'}}>.</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-green-400 font-semibold">$ REX</span>
                        <span className="text-gray-300 font-mono">Querying LinkedIn + Apollo...</span>
                        <i className="fa-solid fa-check text-green-400" />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-green-400 font-semibold">$ REX</span>
                        <span className="text-gray-300 font-mono">Syncing insights...</span>
                        <i className="fa-solid fa-check text-green-400" />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-green-400 font-semibold">$ REX</span>
                        <span className="text-gray-300 font-mono">Done.</span>
                        <i className="fa-solid fa-check text-green-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* REX Response */}
              <div className="message-fade-in">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-robot text-sm" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-mono text-green-400 font-semibold">$ REX</span>
                      <span className="text-xs text-gray-400">Analysis complete</span>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 terminal-glow">
                      <p className="text-green-400 font-semibold mb-4">✅ Found 23 senior React developers in San Francisco. Here are the top 3:</p>
                      <div className="space-y-4">
                        {/* Developer Card 1 */}
                        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-white">Sarah Chen</h3>
                              <p className="text-gray-300">Senior React Developer @ Stripe</p>
                            </div>
                            <span className="bg-green-500 text-black px-2 py-1 rounded text-xs font-semibold">97% Match</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-400">Experience:</span><span className="text-white ml-2">6 years</span></div>
                            <div><span className="text-gray-400">Salary:</span><span className="text-white ml-2">$180k - $220k</span></div>
                            <div><span className="text-gray-400">Skills:</span><span className="text-white ml-2">React, TypeScript, Node.js</span></div>
                            <div><span className="text-gray-400">Location:</span><span className="text-white ml-2">SF, CA</span></div>
                          </div>
                          <div className="mt-3 flex space-x-2">
                            <button className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition-colors"><i className="fa-brands fa-linkedin mr-1" />LinkedIn</button>
                            <button className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm transition-colors"><i className="fa-solid fa-envelope mr-1" />Contact</button>
                          </div>
                        </div>

                        {/* Developer Card 2 */}
                        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-white">Marcus Rodriguez</h3>
                              <p className="text-gray-300">Lead Frontend Engineer @ Airbnb</p>
                            </div>
                            <span className="bg-green-500 text-black px-2 py-1 rounded text-xs font-semibold">94% Match</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-400">Experience:</span><span className="text-white ml-2">8 years</span></div>
                            <div><span className="text-gray-400">Salary:</span><span className="text-white ml-2">$200k - $250k</span></div>
                            <div><span className="text-gray-400">Skills:</span><span className="text-white ml-2">React, GraphQL, AWS</span></div>
                            <div><span className="text-gray-400">Location:</span><span className="text-white ml-2">SF, CA</span></div>
                          </div>
                          <div className="mt-3 flex space-x-2">
                            <button className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition-colors"><i className="fa-brands fa-linkedin mr-1" />LinkedIn</button>
                            <button className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm transition-colors"><i className="fa-solid fa-envelope mr-1" />Contact</button>
                          </div>
                        </div>

                        {/* Developer Card 3 */}
                        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-white">Emily Park</h3>
                              <p className="text-gray-300">Senior Software Engineer @ Meta</p>
                            </div>
                            <span className="bg-yellow-500 text-black px-2 py-1 rounded text-xs font-semibold">91% Match</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-400">Experience:</span><span className="text-white ml-2">5 years</span></div>
                            <div><span className="text-gray-400">Salary:</span><span className="text-white ml-2">$170k - $210k</span></div>
                            <div><span className="text-gray-400">Skills:</span><span className="text-white ml-2">React, Redux, Python</span></div>
                            <div><span className="text-gray-400">Location:</span><span className="text-white ml-2">SF, CA</span></div>
                          </div>
                          <div className="mt-3 flex space-x-2">
                            <button className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition-colors"><i className="fa-brands fa-linkedin mr-1" />LinkedIn</button>
                            <button className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm transition-colors"><i className="fa-solid fa-envelope mr-1" />Contact</button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-gray-900 rounded border border-gray-600">
                        <p className="text-sm text-gray-300"><i className="fa-solid fa-lightbulb text-yellow-400 mr-2" />Want to see more candidates or refine the search? Just let me know your specific requirements!</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Input */}
            <div id="chat-input" className="border-t border-gray-700 p-4 bg-gray-800">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <input type="text" placeholder="Ask REX anything..." className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-colors" />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-400 transition-colors">
                    <i className="fa-solid fa-paper-plane" />
                  </button>
                </div>
                <button className="bg-green-600 hover:bg-green-700 p-3 rounded-lg transition-colors">
                  <i className="fa-solid fa-microphone" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span>Press Enter to send, Shift + Enter for new line</span>
                <span>REX v2.1.0 • Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InteractiveRexPreview;


