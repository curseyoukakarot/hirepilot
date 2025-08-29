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
                    Integrate HirePilot into your workflows using our secure REST API. Use the endpoints below to create, update, enrich, or retrieve leads and react to pipeline & messaging events. Supports Zapier, Make, and REX orchestration.
                </p>
            </div>
        </section>

        <div class="grid lg:grid-cols-4 gap-8">
            <aside id="sidebar" class="lg:col-span-1">
                <nav class="sticky top-24 bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                    <h3 class="text-lg font-semibold mb-4 text-blue-300">Quick Navigation</h3>
                    <ul class="space-y-2">
                        <li><a href="#authentication" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-lock mr-2"></i>Authentication</a></li>
                        <li><a href="#events-universal" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-rss mr-2"></i>Universal Events (Polling)</a></li>
                        <li><a href="#actions" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-bolt mr-2"></i>Action Endpoints</a></li>
                        <li><a href="#messaging-signals" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-envelope-open-text mr-2"></i>Messaging Signals</a></li>
                        <li><a href="#create-lead" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-plus mr-2"></i>Create Lead</a></li>
                        <li><a href="#enrich-lead" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-magic mr-2"></i>Enrich Lead</a></li>
                        <li><a href="#get-leads" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-download mr-2"></i>Legacy: Get Leads</a></li>
                        <li><a href="#pipeline-changes" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-exchange-alt mr-2"></i>Legacy: Pipeline Changes</a></li>
                        <li><a href="#webhooks" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-broadcast-tower mr-2"></i>Webhooks</a></li>
                        <li><a href="#errors" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-bug mr-2"></i>Error Codes</a></li>
                        <li><a href="#best-practices" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-lightbulb mr-2"></i>Best Practices</a></li>
                        <li><a href="#examples" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-project-diagram mr-2"></i>Examples</a></li>
                        <li><a href="#rex" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-robot mr-2"></i>REX Orchestration</a></li>
                        <li><a href="#rate-limits" class="text-gray-400 hover:text-white transition-colors flex items-center py-2 cursor-pointer"><i class="fas fa-tachometer-alt mr-2"></i>Rate Limits</a></li>
                    </ul>
                </nav>
            </aside>

            <div class="lg:col-span-3 space-y-12">
                <!-- Authentication -->
                <section id="authentication" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-lock mr-3"></i>Authentication
                    </h2>
                    <p class="text-gray-400 mb-4">Authenticate every request with your API key. HirePilot supports two header styles:</p>

                    <div class="grid md:grid-cols-2 gap-4">
                        <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-500">Zapier/Make Header</span>
                                <button class="text-blue-400 hover:text-blue-300 text-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
                            </div>
                            <pre class="text-sm overflow-auto" style="color:#ffffff !important">X-API-Key: YOUR_API_KEY</pre>
                        </div>
                        <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-500">Standard Bearer Header</span>
                                <button class="text-blue-400 hover:text-blue-300 text-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
                            </div>
                            <pre class="text-sm overflow-auto" style="color:#ffffff !important">Authorization: Bearer YOUR_API_KEY</pre>
                        </div>
                    </div>

                    <div class="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mt-4">
                        <p class="text-blue-200 text-sm">Generate/rotate your API key in <strong>Settings → Integrations → Zapier/Make</strong>.</p>
                    </div>
                </section>

                <!-- Universal Events -->
                <section id="events-universal" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-rss mr-3"></i>Universal Events (Polling)
                    </h2>
                    <p class="text-gray-400 mb-4">Poll a single endpoint for all event types. Ideal for Zapier/Make schedules.</p>

                    <div class="mb-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900/50 text-blue-400 border border-blue-700">GET</span>
                        <code class="ml-3" style="color:#ffffff !important">/api/zapier/triggers/events</code>
                    </div>

                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-4">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Query Parameters (optional)</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
                        </div>
                        <pre class="text-sm overflow-auto">?event_type=lead_created
?since=2025-01-01T00:00:00Z</pre>
                    </div>

                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Sample Response</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
                        </div>
                        <pre class="text-sm overflow-auto">{
  "events": [
    {
      "id": "evt_123",
      "event_type": "lead_created",
      "created_at": "2025-08-01T12:00:00Z",
      "payload": {
        "id": "lead_abc123",
        "email": "john@example.com",
        "company": "Acme"
      }
    }
  ]
}</pre>
                    </div>

                    <div class="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mt-4">
                        <p class="text-yellow-200 text-sm"><strong>Note:</strong> The universal endpoint supersedes legacy polling endpoints. Keep using legacy routes if you already depend on them—otherwise switch here.</p>
                    </div>
                </section>

                <!-- Action Endpoints (overview) -->
                <section id="actions" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-bolt mr-3"></i>Action Endpoints
                    </h2>
                    <p class="text-gray-400 mb-6">Make HirePilot do something from your automation—create/update leads or enrich them with Apollo.</p>

                    <ul class="list-disc pl-6 text-gray-300 space-y-2">
                        <li><code style="color:#ffffff !important">POST /api/zapier/leads</code> — Create or update a lead</li>
                        <li><code style="color:#ffffff !important">POST /api/zapier/enrich</code> — Enrich a lead via Apollo (by <code style="color:#ffffff !important">lead_id</code> or <code style="color:#ffffff !important">email</code>)</li>
                    </ul>
                </section>

                <!-- Create/Update Lead (detailed) -->
                <section id="create-lead" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-plus mr-3"></i>Create/Update Lead
                    </h2>
                    <div class="mb-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/50 text-green-400 border border-green-700">POST</span>
                        <code class="ml-3 text-green-400">/api/zapier/leads</code>
                    </div>
                    <p class="text-gray-400 mb-4">Create a new lead or update an existing one.</p>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Request Body (minimum: email)</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
                        </div>
                        <pre class="text-sm overflow-auto">{
  "email": "jane@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "company": "Acme",
  "phone": "+15551234567",
  "linkedin_url": "https://linkedin.com/in/janedoe"
}</pre>
                    </div>
                </section>

                <!-- Enrich Lead -->
                <section id="enrich-lead" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-magic mr-3"></i>Enrich Lead
                    </h2>
                    <div class="mb-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/50 text-green-400 border border-green-700">POST</span>
                        <code class="ml-3" style="color:#ffffff !important">/api/zapier/enrich</code>
                    </div>
                    <p class="text-gray-400 mb-4">Enrich a lead with Apollo. We derive user/workspace context from your API key.</p>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-4">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Request Body (option 1)</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
                        </div>
                        <pre class="text-sm overflow-auto">{
  "lead_id": "lead_xyz789"
}</pre>
                    </div>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Request Body (option 2)</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
                        </div>
                        <pre class="text-sm overflow-auto">{
  "email": "alex@acme.com"
}</pre>
                    </div>
                    <div class="bg-orange-900/20 border border-orange-700 rounded-lg p-4 mt-4">
                        <p class="text-orange-200 text-sm">Tip: If you’re unsure about allowed <code>status</code> values in your workspace, omit that field and let HirePilot default it.</p>
                    </div>
                </section>

                <!-- Messaging & Email Signals -->
                <section id="messaging-signals" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-envelope-open-text mr-3"></i>Messaging & Email Signals (Events)
                    </h2>
                    <p class="text-gray-400 mb-4">These event types are emitted via the Universal Events endpoint.</p>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <pre class="text-sm overflow-auto">message_sent
message_reply
email_opened
email_clicked
email_bounced</pre>
                    </div>
                </section>

                <!-- Legacy polling: Get Leads -->
                <section id="get-leads" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-download mr-3"></i>Get New Leads (Legacy)
                    </h2>
                    <div class="mb-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900/50 text-blue-400 border border-blue-700">GET</span>
                        <code class="ml-3 text-green-400">/api/zapier/triggers/new-leads</code>
                    </div>
                    <p class="text-gray-400 mb-4">Legacy polling endpoint. Prefer <code>/api/zapier/triggers/events</code> for new builds.</p>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Sample Response</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
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

                <!-- Legacy polling: Pipeline changes -->
                <section id="pipeline-changes" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-exchange-alt mr-3"></i>Pipeline Stage Changes (Legacy)
                    </h2>
                    <div class="mb-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900/50 text-blue-400 border border-blue-700">GET</span>
                        <code class="ml-3 text-green-400">/api/zapier/triggers/pipeline-stage-changes</code>
                    </div>
                    <p class="text-gray-400">Legacy endpoint. Prefer the universal events endpoint with <code>?event_type=candidate_pipeline_stage_changed</code>.</p>
                </section>

                <!-- Webhooks -->
                <section id="webhooks" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-broadcast-tower mr-3"></i>Webhooks (Real-Time Push)
                    </h2>
                    <p class="text-gray-400 mb-4">Receive push events when leads/candidates are created or their stages change.</p>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Sample Webhook Payload</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
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

                <!-- Error Codes -->
                <section id="errors" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-bug mr-3"></i>Error Codes
                    </h2>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <pre class="text-sm overflow-auto">400  Missing/invalid fields (e.g., email required)
401  Unauthorized (invalid/missing API key)
403  Forbidden (insufficient permissions)
404  Not found (e.g., lead to enrich not found)
422  Apollo parameter error (details in response)
500  Unexpected server error (include response JSON)</pre>
                    </div>
                </section>

                <!-- Best Practices -->
                <section id="best-practices" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-lightbulb mr-3"></i>Best Practices
                    </h2>
                    <ul class="list-disc pl-6 text-gray-300 space-y-2">
                        <li>Keep your API key secret. Rotate if exposed.</li>
                        <li>Use <code>?since=</code> to poll only recent events (every 10–15 minutes is a good default).</li>
                        <li>Filter by <code>event_type</code> during testing to avoid noisy automations.</li>
                        <li>Chain actions logically: Create → Enrich → Notify → Sync to CRM.</li>
                        <li>Let HirePilot default <code>status</code> if you’re unsure of allowed values.</li>
                    </ul>
                </section>

                <!-- Examples -->
                <section id="examples" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-project-diagram mr-3"></i>Examples
                    </h2>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-4">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Zapier Poll → Create → Enrich → Slack</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
                        </div>
                        <pre class="text-sm overflow-auto">1) GET /api/zapier/triggers/events?event_type=lead_created&since={{zap_meta_human_now}}
2) POST /api/zapier/leads {"email":"alex@acme.com", ...}
3) POST /api/zapier/enrich {"lead_id":"{{lead.id}}"}
4) Slack message with enrich summary</pre>
                    </div>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-500">Pipeline Move → Interview Prep</span>
                            <button class="text-blue-400 hover:text-blue-300 text-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
                        </div>
                        <pre class="text-sm overflow-auto">Trigger: event_type=candidate_pipeline_stage_changed
Actions:
- Create calendar placeholder
- Generate interviewer checklist
- Create task in Asana/Trello</pre>
                    </div>
                </section>

                <!-- REX Orchestration -->
                <section id="rex" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
                    <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center">
                        <i class="fas fa-robot mr-3"></i>REX Orchestration
                    </h2>
                    <p class="text-gray-400 mb-4">Trigger automations by talking to REX inside HirePilot:</p>
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <pre class="text-sm overflow-auto">"Test my lead_created Zap"
"Send an event to my Zapier webhook"
"Enrich the last 10 new leads and DM me the summary"</pre>
                    </div>
                    <p class="text-gray-400 mt-4">Under the hood, REX calls the same REST endpoints and/or your webhook, enabling natural-language flows.</p>
                </section>

                <!-- Rate Limits -->
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
                document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
            });
        });

        document.querySelectorAll('button').forEach(button => {
            if (button.textContent.includes('Copy')) {
                button.addEventListener('click', function() {
                    const pre = this.closest('.bg-gray-800').querySelector('pre');
                    if (!pre) return;
                    navigator.clipboard.writeText(pre.textContent);
                    this.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
                    setTimeout(() => { this.innerHTML = '<i class=\"fas fa-copy mr-1\"></i>Copy'; }, 2000);
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