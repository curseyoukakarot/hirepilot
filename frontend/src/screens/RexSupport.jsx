import React from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function RexSupport() {
  const html = String.raw`
    <header id="header" class="relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div class="relative max-w-6xl mx-auto px-6 py-16">
            <div class="text-center">
                <div class="inline-flex items-center bg-blue-500/20 border border-blue-400/30 rounded-full px-6 py-2 mb-6">
                    <i class="fa-solid fa-robot text-blue-400 mr-3 text-lg"></i>
                    <span class="text-blue-300 font-medium">AI Recruiting Assistant</span>
                </div>
                <h1 class="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-6">
                    REX Documentation
                </h1>
                <p class="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                    Your intelligent AI assistant that automates sourcing, enrichment, messaging, analytics, and integrations using natural language commands.
                </p>
            </div>
        </div>
    </header>

    <main id="main-content" class="max-w-6xl mx-auto px-6 py-12">
        
        <section id="quick-start" class="mb-16">
            <div class="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-400/20 rounded-2xl p-8">
                <h2 class="text-2xl font-bold text-blue-300 mb-4 flex items-center">
                    <i class="fa-solid fa-rocket mr-3"></i>
                    Quick Start Guide
                </h2>
                <p class="text-gray-300 mb-6">Simply type or speak to REX using natural language. Here are the main categories of what REX can help you with:</p>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-slate-800/50 rounded-lg p-4 text-center">
                        <i class="fa-solid fa-search text-blue-400 text-2xl mb-2"></i>
                        <div class="text-sm font-medium">Sourcing</div>
                    </div>
                    <div class="bg-slate-800/50 rounded-lg p-4 text-center">
                        <i class="fa-solid fa-user-plus text-purple-400 text-2xl mb-2"></i>
                        <div class="text-sm font-medium">Enrichment</div>
                    </div>
                    <div class="bg-slate-800/50 rounded-lg p-4 text-center">
                        <i class="fa-solid fa-envelope text-green-400 text-2xl mb-2"></i>
                        <div class="text-sm font-medium">Messaging</div>
                    </div>
                    <div class="bg-slate-800/50 rounded-lg p-4 text-center">
                        <i class="fa-solid fa-chart-line text-orange-400 text-2xl mb-2"></i>
                        <div class="text-sm font-medium">Analytics</div>
                    </div>
                </div>
            </div>
        </section>

        <div class="grid lg:grid-cols-2 gap-8">
            
            <section id="lead-sourcing" class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8">
                <h2 class="text-2xl font-bold text-blue-300 mb-6 flex items-center">
                    <i class="fa-solid fa-search text-blue-400 mr-3"></i>
                    Lead Sourcing
                </h2>
                <div class="space-y-4">
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-blue-400">
                        <p class="text-gray-300">"REX, source 10 product managers for this role."</p>
                    </div>
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-blue-400">
                        <p class="text-gray-300">"REX, pull 20 Apollo leads for my SDR campaign."</p>
                    </div>
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-blue-400">
                        <p class="text-gray-300">"REX, find top leads in my campaign who opened but didn't reply."</p>
                    </div>
                </div>
            </section>

            <section id="lead-enrichment" class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8">
                <h2 class="text-2xl font-bold text-purple-300 mb-6 flex items-center">
                    <i class="fa-solid fa-user-plus text-purple-400 mr-3"></i>
                    Lead Enrichment
                </h2>
                <div class="space-y-4">
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-purple-400">
                        <p class="text-gray-300">"REX, enrich this lead with a personal email."</p>
                    </div>
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-purple-400">
                        <p class="text-gray-300">"REX, enrich this batch of leads with emails."</p>
                    </div>
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-purple-400">
                        <p class="text-gray-300">"REX, enrich this lead with a verified email."</p>
                    </div>
                </div>
            </section>

            <section id="messaging" class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8">
                <h2 class="text-2xl font-bold text-green-300 mb-6 flex items-center">
                    <i class="fa-solid fa-envelope text-green-400 mr-3"></i>
                    Messaging
                </h2>
                <div class="space-y-4">
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-green-400">
                        <p class="text-gray-300">"REX, write a 3-step cold email sequence for this candidate."</p>
                    </div>
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-green-400">
                        <p class="text-gray-300">"REX, create a follow-up message for someone who opened but didn't reply."</p>
                    </div>
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-green-400">
                        <p class="text-gray-300">"REX, schedule the SDR follow-up template for these 50 leads tomorrow at 9 AM."</p>
                    </div>
                </div>
            </section>

            <section id="pipeline-insights" class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8">
                <h2 class="text-2xl font-bold text-orange-300 mb-6 flex items-center">
                    <i class="fa-solid fa-chart-line text-orange-400 mr-3"></i>
                    Pipeline Insights
                </h2>
                <div class="space-y-4">
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-orange-400">
                        <p class="text-gray-300">"REX, show me all candidates in the Phone Screen stage."</p>
                    </div>
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-orange-400">
                        <p class="text-gray-300">"REX, who hasn't moved stages in 7 days?"</p>
                    </div>
                    <div class="bg-slate-900/50 rounded-lg p-4 border-l-4 border-orange-400">
                        <p class="text-gray-300">"REX, move Jane Smith to Final Interview."</p>
                    </div>
                </div>
            </section>

        </div>

        <section id="advanced-features" class="mt-12">
            <h2 class="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Advanced Features
            </h2>
            
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                <div id="integrations-card" class="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                    <div class="flex items-center mb-4">
                        <i class="fa-solid fa-link text-cyan-400 text-xl mr-3"></i>
                        <h3 class="text-lg font-semibold text-cyan-300">Integrations</h3>
                    </div>
                    <div class="space-y-3">
                        <p class="text-sm text-gray-300">"REX, trigger the Zapier webhook for SDR follow-up."</p>
                        <p class="text-sm text-gray-300">"REX, trigger the Make.com SDR follow-up workflow."</p>
                    </div>
                </div>

                <div id="credit-usage-card" class="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                    <div class="flex items-center mb-4">
                        <i class="fa-solid fa-credit-card text-yellow-400 text-xl mr-3"></i>
                        <h3 class="text-lg font-semibold text-yellow-300">Credit Usage</h3>
                    </div>
                    <div class="space-y-3">
                        <p class="text-sm text-gray-300">"REX, how many credits do I have left?"</p>
                        <p class="text-sm text-gray-300">"REX, explain what's using the most credits this week."</p>
                    </div>
                </div>

                <div id="help-center-card" class="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                    <div class="flex items-center mb-4">
                        <i class="fa-solid fa-question-circle text-red-400 text-xl mr-3"></i>
                        <h3 class="text-lg font-semibold text-red-300">Help Center</h3>
                    </div>
                    <p class="text-sm text-gray-300">"REX, open the support article on LinkedIn cookies."</p>
                </div>

                <div id="email-status-card" class="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                    <div class="flex items-center mb-4">
                        <i class="fa-solid fa-envelope-circle-check text-emerald-400 text-xl mr-3"></i>
                        <h3 class="text-lg font-semibold text-emerald-300">Email Status</h3>
                    </div>
                    <div class="space-y-3">
                        <p class="text-sm text-gray-300">"REX, did my message to Jordan get delivered?"</p>
                        <p class="text-sm text-gray-300">"REX, test my SendGrid API key."</p>
                    </div>
                </div>

                <div id="api-setup-card" class="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                    <div class="flex items-center mb-4">
                        <i class="fa-solid fa-code text-indigo-400 text-xl mr-3"></i>
                        <h3 class="text-lg font-semibold text-indigo-300">API &amp; Webhooks</h3>
                    </div>
                    <div class="space-y-3">
                        <p class="text-sm text-gray-300">"REX, create my API key for integrations."</p>
                        <p class="text-sm text-gray-300">"REX, save this Zapier hook for lead.created events."</p>
                    </div>
                </div>

                <div id="sending-addresses-card" class="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                    <div class="flex items-center mb-4">
                        <i class="fa-solid fa-at text-pink-400 text-xl mr-3"></i>
                        <h3 class="text-lg font-semibold text-pink-300">Sending Addresses</h3>
                    </div>
                    <p class="text-sm text-gray-300">"REX, which email senders can I use?"</p>
                </div>

            </div>
        </section>

        <section id="tips-section" class="mt-16 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-400/20 rounded-2xl p-8">
            <h2 class="text-2xl font-bold text-blue-300 mb-6 flex items-center">
                <i class="fa-solid fa-lightbulb text-yellow-400 mr-3"></i>
                Pro Tips for Using REX
            </h2>
            <div class="grid md:grid-cols-2 gap-6">
                <div class="space-y-4">
                    <div class="flex items-start">
                        <i class="fa-solid fa-check-circle text-green-400 mr-3 mt-1"></i>
                        <p class="text-gray-300">Use natural language - REX understands conversational commands</p>
                    </div>
                    <div class="flex items-start">
                        <i class="fa-solid fa-check-circle text-green-400 mr-3 mt-1"></i>
                        <p class="text-gray-300">Be specific with numbers and timeframes for better results</p>
                    </div>
                </div>
                <div class="space-y-4">
                    <div class="flex items-start">
                        <i class="fa-solid fa-check-circle text-green-400 mr-3 mt-1"></i>
                        <p class="text-gray-300">REX can handle batch operations to save you time</p>
                    </div>
                    <div class="flex items-start">
                        <i class="fa-solid fa-check-circle text-green-400 mr-3 mt-1"></i>
                        <p class="text-gray-300">Ask REX for help if you're unsure about a command</p>
                    </div>
                </div>
            </div>
        </section>

    </main>

    <footer id="footer" class="bg-slate-900/50 border-t border-slate-700/50 mt-20">
        <div class="max-w-6xl mx-auto px-6 py-12">
            <div class="text-center">
                <div class="mb-6">
                    <i class="fa-solid fa-robot text-blue-400 text-3xl mb-4"></i>
                    <h3 class="text-xl font-semibold text-blue-300 mb-2">Need More Help?</h3>
                    <p class="text-gray-400">Our support team is here to help you get the most out of REX</p>
                </div>
                <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <span class="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors cursor-pointer">
                        <i class="fa-solid fa-envelope mr-2"></i>
                        Contact Support
                    </span>
                    <div class="text-sm text-gray-500">
                        Questions? Email <span class="underline text-blue-400 hover:text-blue-300 cursor-pointer">support@thehirepilot.com</span>
                    </div>
                </div>
            </div>
        </div>
    </footer>`;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <PublicNavbar />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <PublicFooter />
    </div>
  );
} 