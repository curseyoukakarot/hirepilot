import React from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function ApiDocs() {
  const html = String.raw`
    <main class="max-w-6xl mx-auto px-6 py-10">
        <section id="hero" class="mb-12">
            <div class="text-center mb-8">
                <h1 class="text-4xl font-bold mb-4 text-blue-400">
                    <i class="fas fa-book mr-3"></i>API Reference
                </h1>
                <p class="text-xl text-gray-300 max-w-3xl mx-auto">
                    Integrate HirePilot into your workflows using our secure REST API. Use the endpoints below to create, update, enrich, or retrieve leads. Real-time webhook support included.
                </p>
            </div>
        </section>

        <div class="grid lg:grid-cols-4 gap-8">
            <aside id="sidebar" class="lg:col-span-1">
                <nav class="sticky top-24 bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                    <h3 class="text-lg font-semibold mb-4 text-blue-300">Quick Navigation</h3>
                    <ul class="space-y-2">
                        <li><a href="#authentication" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer">
                            <i class="fas fa-lock mr-2"></i>Authentication
                        </a></li>
                        <li><a href="#create-lead" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer">
                            <i class="fas fa-plus mr-2"></i>Create Lead
                        </a></li>
                        <li><a href="#enrich-lead" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer">
                            <i class="fas fa-magic mr-2"></i>Enrich Lead
                        </a></li>
                        <li><a href="#get-leads" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer">
                            <i class="fas fa-download mr-2"></i>Get Leads
                        </a></li>
                        <li><a href="#webhooks" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer">
                            <i class="fas fa-broadcast-tower mr-2"></i>Webhooks
                        </a></li>
                        <li><a href="#rate-limits" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer">
                            <i class="fas fa-tachometer-alt mr-2"></i>Rate Limits
                        </a></li>
                    </ul>
                </nav>
            </aside>

            <div class="lg:col-span-3 space-y-12">
                <section id="authentication" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-lock mr-3"></i>Authentication
                    </h2>
                    <p class="text-gray-400 mb-4">Include your API key in every request header:</p>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Authorization Header</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm">
                                <i class="fas fa-copy mr-1"></i>Copy
                            </button>
                        </div>
                        <pre class="text-sm text-green-400 overflow-auto">Authorization: Bearer YOUR_API_KEY</pre>
                    </div>
                </section>

                <section id="create-lead" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-plus mr-3"></i>Create/Update Lead
                    </h2>
                    <div class="mb-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/50 text-green-400 border border-green-700">
                            POST
                        </span>
                        <code class="ml-3 text-green-400">/api/zapier/leads</code>
                    </div>
                    <p class="text-gray-400 mb-4">Create a new lead or update an existing one in your campaign.</p>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Request Body</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm">
                                <i class="fas fa-copy mr-1"></i>Copy
                            </button>
                        </div>
                        <pre class="text-sm overflow-auto">{
  "campaign_id": "camp_abc123",
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+15551234567",
  "linkedin_url": "https://linkedin.com/in/janedoe"
}</pre>
                    </div>
                </section>

                <section id="enrich-lead" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-magic mr-3"></i>Enrich Lead
                    </h2>
                    <div class="mb-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/50 text-green-400 border border-green-700">
                            POST
                        </span>
                        <code class="ml-3 text-green-400">/api/zapier/enrich</code>
                    </div>
                    <p class="text-gray-400 mb-4">Enrich an existing lead with additional data and insights.</p>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Request Body</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm">
                                <i class="fas fa-copy mr-1"></i>Copy
                            </button>
                        </div>
                        <pre class="text-sm overflow-auto">{
  "lead_id": "lead_xyz789"
}</pre>
                    </div>
                </section>

                <section id="get-leads" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-download mr-3"></i>Get New Leads
                    </h2>
                    <div class="mb-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900/50 text-blue-400 border border-blue-700">
                            GET
                        </span>
                        <code class="ml-3 text-green-400">/api/zapier/triggers/new-leads</code>
                    </div>
                    <p class="text-gray-400 mb-4">Retrieve newly created leads for polling-based integrations.</p>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Sample Response</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm">
                                <i class="fas fa-copy mr-1"></i>Copy
                            </button>
                        </div>
                        <pre class="text-sm overflow-auto">[
  {
    "id": "lead_abc123",
    "full_name": "John Smith",
    "email": "john@example.com",
    "campaign_id": "camp_001"
  }
]</pre>
                    </div>
                </section>

                <section id="pipeline-changes" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-exchange-alt mr-3"></i>Pipeline Stage Changes
                    </h2>
                    <div class="mb-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900/50 text-blue-400 border border-blue-700">
                            GET
                        </span>
                        <code class="ml-3 text-green-400">/api/zapier/triggers/pipeline-stage-changes</code>
                    </div>
                    <p class="text-gray-400">Monitor when leads move between different pipeline stages.</p>
                </section>

                <section id="webhooks" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-broadcast-tower mr-3"></i>Webhooks (Real-Time Push)
                    </h2>
                    <p class="text-gray-400 mb-4">Receive push events when leads are created or their stages change.</p>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Sample Webhook Payload</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm">
                                <i class="fas fa-copy mr-1"></i>Copy
                            </button>
                        </div>
                        <pre class="text-sm overflow-auto">{
  "event": "lead.created",
  "lead": {
    "id": "lead_abc123",
    "full_name": "Jane Doe",
    "email": "jane@example.com"
  },
  "timestamp": "2025-07-07T00:01:02Z"
}</pre>
                    </div>

                    <div class="bg-orange-900/20 border border-orange-700 rounded-lg p-4">
                        <h3 class="text-lg font-semibold text-orange-300 mb-3 flex items-center">
                            <i class="fas fa-shield-alt mr-2"></i>Signature Verification
                        </h3>
                        <p class="text-gray-400 mb-3">Each webhook includes an <code class="text-orange-400">X-HirePilot-Signature</code> header (HMAC-SHA256).</p>
                        <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                            <pre class="text-sm overflow-auto">const crypto = require('crypto');

function verifySignature(payload, header, secret) {
  const expected = crypto.createHmac('sha256', secret)
    .update(payload).digest('hex');
  return expected === header;
}</pre>
                        </div>
                    </div>
                </section>

                <section id="rate-limits" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-tachometer-alt mr-3"></i>Rate Limits
                    </h2>
                    <div class="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                        <div class="flex items-center mb-2">
                            <i class="fas fa-exclamation-triangle text-yellow-400 mr-2"></i>
                            <span class="text-yellow-300 font-medium">Rate Limit: 60 requests per minute</span>
                        </div>
                        <p class="text-gray-400">Each API key is limited to 60 requests per minute. Contact us if you need higher limits.</p>
                    </div>
                </section>
            </div>
        </div>
    </main>

    <footer id="footer" class="border-t border-gray-800 bg-gray-900/50 mt-16">
        <div class="max-w-6xl mx-auto px-6 py-8">
            <div class="text-center">
                <p class="text-gray-400 mb-2">Need help with the API?</p>
                <span class="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
                    <i class="fas fa-envelope mr-2"></i>
                    support@thehirepilot.com
                </span>
            </div>
        </div>
    </footer>

    <script>
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });

        document.querySelectorAll('button').forEach(button => {
            if (button.textContent.includes('Copy')) {
                button.addEventListener('click', function() {
                    const pre = this.closest('.bg-gray-800').querySelector('pre');
                    navigator.clipboard.writeText(pre.textContent);
                    this.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
                    setTimeout(() => {
                        this.innerHTML = '<i class="fas fa-copy mr-1"></i>Copy';
                    }, 2000);
                });
            }
        });
    </script>`;

  return (
    <div className="bg-gray-950 text-white font-sans">
      <PublicNavbar />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <PublicFooter />
    </div>
  );
} 