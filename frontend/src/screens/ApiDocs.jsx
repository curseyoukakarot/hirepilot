import React, { useEffect } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function ApiDocs() {
  const html = String.raw`
  <main class="max-w-6xl mx-auto px-6 pt-28 pb-10">
    <!-- HERO -->
    <section id="hero" class="mb-12 text-center">
      <h1 class="text-4xl font-bold mb-4 text-blue-400">
        <i class="fas fa-book mr-3"></i>HirePilot API Reference
      </h1>
      <p class="text-xl text-gray-300 max-w-3xl mx-auto">
        Build and automate recruiting workflows with the <strong>HirePilot API</strong>.  
        Trigger events in Zapier/Make or orchestrate actions directly through <strong>REX</strong>.
        All endpoints are authenticated and follow REST conventions.
      </p>
    </section>

    <div class="grid lg:grid-cols-4 gap-8">
      <!-- SIDEBAR -->
      <aside id="sidebar" class="lg:col-span-1">
        <nav class="sticky top-24 bg-gray-900/50 rounded-xl p-6 border border-gray-800">
          <h3 class="text-lg font-semibold mb-4 text-blue-300">Quick Navigation</h3>
          <ul class="space-y-2 text-gray-400">
            <li><a href="#authentication" class="hover:text-white flex items-center py-1"><i class="fas fa-lock mr-2"></i>Authentication</a></li>
            <li><a href="#events-universal" class="hover:text-white flex items-center py-1"><i class="fas fa-rss mr-2"></i>Universal Events</a></li>
            <li><a href="#actions" class="hover:text-white flex items-center py-1"><i class="fas fa-bolt mr-2"></i>Actions</a></li>
            <li><a href="#rex" class="hover:text-white flex items-center py-1"><i class="fas fa-robot mr-2"></i>REX Tools</a></li>
            <li><a href="#examples" class="hover:text-white flex items-center py-1"><i class="fas fa-code mr-2"></i>Examples</a></li>
            <li><a href="#rate-limits" class="hover:text-white flex items-center py-1"><i class="fas fa-tachometer-alt mr-2"></i>Rate Limits</a></li>
          </ul>
        </nav>
      </aside>

      <!-- MAIN CONTENT -->
      <div class="lg:col-span-3 space-y-12">

        <!-- AUTH -->
        <section id="authentication" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
          <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center"><i class="fas fa-lock mr-3"></i>Authentication</h2>
          <p class="text-gray-400 mb-4">Include your API key in every request header:</p>
          <pre class="bg-gray-800 border border-gray-700 p-4 rounded-lg text-sm text-white">X-API-Key: YOUR_API_KEY</pre>
        </section>

        <!-- UNIVERSAL EVENTS -->
        <section id="events-universal" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
          <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center"><i class="fas fa-rss mr-3"></i>Universal Events</h2>
          <p class="text-gray-400 mb-4">Poll once and receive all activity in your workspace — leads, candidates, deals, campaigns, and REX actions.</p>

          <pre class="bg-gray-800 border border-gray-700 p-4 rounded-lg text-sm text-white mb-3">
GET /api/zapier/triggers/events?event_type=opportunity_submitted&amp;since=2025-01-01T00:00:00Z
          </pre>

          <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-gray-500">Sample Event Payload</span>
            </div>
            <pre class="text-sm overflow-auto text-white">{
  "id": "evt_789",
  "event_type": "opportunity_submitted",
  "created_at": "2025-10-23T00:00:00Z",
  "payload": {
    "candidate": "Jane Doe",
    "opportunity_id": "opp_123",
    "status": "submitted"
  }
}</pre>
          </div>
        </section>

        <!-- ACTION ENDPOINTS -->
        <section id="actions" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
          <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center"><i class="fas fa-bolt mr-3"></i>Action Endpoints</h2>
          <p class="text-gray-400 mb-4">Trigger actions manually or from automations. All actions are REX-compatible and emit events back into the feed.</p>

          <!-- Deals & Submissions -->
          <h3 class="text-lg font-semibold text-green-300 mt-6 mb-2">📈 Deals & Submissions</h3>
          <ul class="list-disc pl-6 text-gray-300 mb-4">
            <li><code>/api/opportunities/:id/submit-to-client</code> — Mark candidate submitted</li>
            <li><code>/api/opportunities/:id/application</code> — Create job application</li>
            <li><code>/api/opportunities/:id/notes</code> — Add or update notes</li>
            <li><code>/api/deals/activity</code> — Log deal activity</li>
            <li><code>/api/opportunities/:id/collaborators</code> — Add collaborator</li>
          </ul>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X POST https://api.thehirepilot.com/api/opportunities/123/submit-to-client \
-H "X-API-Key: YOUR_API_KEY" \
-d '{"status":"submitted","notes":"Sent via automation"}'</pre>
            </div>
          </div>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mt-3">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example (Add Collaborator)</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X POST https://api.thehirepilot.com/api/opportunities/123/collaborators \
-H "X-API-Key: YOUR_API_KEY" \
-d '{"email":"teammate@acme.com","role":"viewer"}'</pre>
            </div>
          </div>

          <!-- Messaging & Campaigns -->
          <h3 class="text-lg font-semibold text-green-300 mt-8 mb-2">💬 Messaging & Campaigns</h3>
          <ul class="list-disc pl-6 text-gray-300 mb-4">
            <li><code>/api/messages/bulk-schedule</code> — Schedule mass messages</li>
            <li><code>/api/sourcing/campaigns/:id/relaunch</code> — Relaunch campaign</li>
            <li><code>/api/sourcing/campaigns/:id/schedule</code> — Schedule new launch</li>
            <li><code>/api/scheduleMassMessage</code> — Schedule mass messages</li>
            <li><code>/api/sourcing/campaigns/:id/stats</code> — Stats (emit snapshot with ?emit=true)</li>
          </ul>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example (Bulk Schedule)</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X POST https://api.thehirepilot.com/api/messages/bulk-schedule \
-H "X-API-Key: YOUR_API_KEY" \
-d '{"message":"Hi {{first_name}}, excited to connect!","leads":["lead_1","lead_2"]}'</pre>
            </div>
          </div>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mt-3">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example (scheduleMassMessage)</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X POST https://api.thehirepilot.com/api/scheduleMassMessage \
-H "X-API-Key: YOUR_API_KEY" \
-d '{"messages":[{"leadId":"l1","templateId":"t1"}]}'</pre>
            </div>
          </div>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mt-3">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example (Campaign Stats)</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl "https://api.thehirepilot.com/api/sourcing/campaigns/camp_123/stats?emit=true" \
-H "X-API-Key: YOUR_API_KEY"</pre>
            </div>
          </div>

          <h3 class="text-lg font-semibold text-green-300 mt-6 mb-2">🧠 Enrichment & Intelligence</h3>
          <ul class="list-disc pl-6 text-gray-300 mb-4">
            <li><code>/api/leads/:id/enrich</code> — Enrich lead</li>
            <li><code>/api/candidates/:id/enrich</code> — Enrich candidate</li>
          </ul>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example (Lead Enrich)</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X POST https://api.thehirepilot.com/api/leads/lead_123/enrich \
-H "X-API-Key: YOUR_API_KEY"</pre>
            </div>
          </div>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mt-3">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example (Candidate Enrich)</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X POST https://api.thehirepilot.com/api/candidates/cand_123/enrich \
-H "X-API-Key: YOUR_API_KEY"</pre>
            </div>
          </div>

          <!-- Clients & Contacts -->
          <h3 class="text-lg font-semibold text-green-300 mt-8 mb-2">🤝 CRM / Client Sync</h3>
          <ul class="list-disc pl-6 text-gray-300 mb-4">
            <li><code>/api/clients</code> — Create client</li>
            <li><code>/api/clients/:id</code> — Update client</li>
            <li><code>/api/clients/:id/sync-enrichment</code> — Enrich client</li>
            <li><code>/api/contacts</code> — Add new contact</li>
          </ul>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example (Client Enrich)</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X POST https://api.thehirepilot.com/api/clients/cli_123/sync-enrichment \
-H "X-API-Key: YOUR_API_KEY"</pre>
            </div>
          </div>

          <h3 class="text-lg font-semibold text-green-300 mt-8 mb-2">👥 Teams / Notifications</h3>
          <ul class="list-disc pl-6 text-gray-300 mb-4">
            <li><code>/api/team/invite</code> — Invite member</li>
            <li><code>PUT /api/team/member/:id/role</code> — Update role</li>
            <li><code>/api/notifications</code> — Create notification</li>
            <li><code>/api/invoices/create</code> — Create invoice</li>
          </ul>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example (Team Invite)</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X POST https://api.thehirepilot.com/api/team/invite \
-H "X-API-Key: YOUR_API_KEY" \
-d '{"email":"newuser@example.com","role":"member"}'</pre>
            </div>
          </div>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mt-3">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example (Update Role)</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X PUT https://api.thehirepilot.com/api/team/member/mem_123/role \
-H "X-API-Key: YOUR_API_KEY" \
-d '{"role":"admin"}'</pre>
            </div>
          </div>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mt-3">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example (Create Invoice)</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X POST https://api.thehirepilot.com/api/invoices/create \
-H "X-API-Key: YOUR_API_KEY" \
-d '{"client_id":"cli_123","amount":5000,"billing_type":"fixed","opportunity_id":"opp_123"}'</pre>
            </div>
          </div>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X POST https://api.thehirepilot.com/api/clients \
-H "X-API-Key: YOUR_API_KEY" \
-d '{"name":"Acme Corp","industry":"SaaS","website":"https://acme.com"}'</pre>
            </div>
          </div>

          <!-- Sniper -->
          <h3 class="text-lg font-semibold text-green-300 mt-8 mb-2">🎯 Sniper & Prospecting</h3>
          <ul class="list-disc pl-6 text-gray-300 mb-4">
            <li><code>/api/sniper/targets</code> — Add new targets</li>
            <li><code>/api/sniper/targets/:id/capture-now</code> — Trigger capture</li>
          </ul>

          <h3 class="text-lg font-semibold text-green-300 mt-8 mb-2">🤖 REX / Tools</h3>
          <ul class="list-disc pl-6 text-gray-300 mb-4">
            <li><code>/api/rex/tools/linkedin_connect</code> — LinkedIn connect</li>
          </ul>

          <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <button class="toggle-btn w-full text-left flex justify-between items-center p-4 hover:bg-gray-750 transition">
              <span class="text-blue-300 font-semibold">View cURL Example (LinkedIn Connect)</span>
              <i class="fas fa-chevron-down text-blue-300 transition-transform duration-200"></i>
            </button>
            <div class="hidden toggle-content p-4 border-t border-gray-700">
              <div class="flex justify-end mb-2">
                <button class="copy-btn px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Copy</button>
              </div>
              <pre class="text-sm text-white overflow-auto">curl -X POST https://api.thehirepilot.com/api/rex/tools/linkedin_connect \
-H "Authorization: Bearer $USER_JWT" \
-H "Content-Type: application/json" \
-d '{"linkedin_urls":["https://linkedin.com/in/janedoe"],"message":"Great to connect!"}'</pre>
            </div>
          </div>

          <div class="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mt-6">
            <p class="text-blue-200 text-sm">Note: Billing, credit, and administrative endpoints are reserved for Super Admin use only and are not exposed through the public API.</p>
          </div>
        </section>

        <!-- REX TOOLS -->
        <section id="rex" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
          <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center"><i class="fas fa-robot mr-3"></i>REX Tool Invocation</h2>
          <p class="text-gray-400 mb-4">Every REST endpoint can also be invoked by REX using its tool registry.  
          This enables conversational automation without leaving HirePilot.</p>

          <pre class="bg-gray-800 border border-gray-700 p-4 rounded-lg text-sm text-white mb-4">
rex run opportunity.submitToClient --id=123
rex run sourcing.relaunch --campaign=45
rex run clients.create --name="Acme Corp"
          </pre>

          <p class="text-gray-400 mt-2">All tool executions emit a <code>rex_chat_triggered</code> event and appear in <code>/api/zapier/triggers/events</code>.</p>
        </section>

        <!-- REX Playground Adaptive -->
        <section id="rex-playground" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
          <h2 class="text-2xl font-semibold text-blue-300 mb-6 flex items-center">
            <i class="fas fa-terminal mr-3"></i>Live REX Playground
          </h2>
          <p class="text-gray-400 mb-6">
            See how REX turns your words into real API actions and events.
            Choose a category below and replay an actual conversation.
          </p>

          <!-- Category Tabs -->
          <div class="flex flex-wrap gap-3 mb-6">
            <button class="rex-tab active-tab bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium" data-target="rexDeals">📈 Deals & Submissions</button>
            <button class="rex-tab bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium" data-target="rexMessaging">💬 Messaging & Campaigns</button>
            <button class="rex-tab bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium" data-target="rexClients">🤝 Clients & CRM</button>
            <button class="rex-tab bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium" data-target="rexSniper">🎯 Sniper & Prospecting</button>
          </div>

          <!-- Chat Containers -->
          <div id="rexPlaygroundContainer" class="space-y-6">
            <!-- Deals -->
            <div id="rexDeals" class="rex-thread space-y-4">
              <div class="flex flex-col space-y-2">
                <div class="self-start bg-blue-900/40 border border-blue-700 text-blue-100 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>You:</strong> REX, submit Jane Doe to Acme Corp for the Account Executive role.
                </div>
                <div class="self-end bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>REX:</strong> ✅ Candidate Jane Doe submitted to Acme Corp.  
                  <span class="text-sm text-blue-400 block mt-1">(POST /api/opportunities/:id/submit-to-client → event: opportunity_submitted)</span>
                </div>
              </div>
              <div class="text-right mt-3">
                <button class="tryRex bg-blue-800 hover:bg-blue-700 text-sm text-white px-3 py-1 rounded-md"
                  data-command="Submit Jane Doe to Acme Corp for the Account Executive role"
                  data-api="POST /api/opportunities/:id/submit-to-client\n{\n  'status': 'submitted',\n  'notes': 'Sent via automation'\n}"
                  data-event="opportunity_submitted">
                  🧪 Try This in REX Console
                </button>
              </div>

              <div class="flex flex-col space-y-2">
                <div class="self-start bg-blue-900/40 border border-blue-700 text-blue-100 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>You:</strong> Add an internal note for this deal: “Client expects interview next week.”
                </div>
                <div class="self-end bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>REX:</strong> 📝 Note added to deal successfully.  
                  <span class="text-sm text-blue-400 block mt-1">(PATCH /api/opportunities/:id/notes → event: opportunity_note_added)</span>
                </div>
              </div>
              <div class="text-right mt-3">
                <button class="tryRex bg-blue-800 hover:bg-blue-700 text-sm text-white px-3 py-1 rounded-md"
                  data-command="Add an internal note for this deal: “Client expects interview next week.”"
                  data-api="PATCH /api/opportunities/:id/notes\n{\n  'notes': 'Client expects interview next week.'\n}"
                  data-event="opportunity_note_added">
                  🧪 Try This in REX Console
                </button>
              </div>
            </div>

            <!-- Messaging -->
            <div id="rexMessaging" class="rex-thread hidden space-y-4">
              <div class="flex flex-col space-y-2">
                <div class="self-start bg-blue-900/40 border border-blue-700 text-blue-100 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>You:</strong> Send a batch message to everyone who opened last week’s email.
                </div>
                <div class="self-end bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>REX:</strong> 💌 Message batch scheduled for 132 recipients.  
                  <span class="text-sm text-blue-400 block mt-1">(POST /api/messages/bulk-schedule → event: message_batch_scheduled)</span>
                </div>
              </div>
              <div class="text-right mt-3">
                <button class="tryRex bg-blue-800 hover:bg-blue-700 text-sm text-white px-3 py-1 rounded-md"
                  data-command="Schedule a batch message to everyone who opened last week’s email"
                  data-api="POST /api/messages/bulk-schedule\n{\n  'template_id': 'tmpl_1',\n  'lead_ids': ['l1','l2'],\n  'scheduled_at': '2025-01-10T15:00:00Z'\n}"
                  data-event="message_batch_scheduled">
                  🧪 Try This in REX Console
                </button>
              </div>

              <div class="flex flex-col space-y-2">
                <div class="self-start bg-blue-900/40 border border-blue-700 text-blue-100 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>You:</strong> REX, relaunch my “AE Candidates - Austin” campaign.
                </div>
                <div class="self-end bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>REX:</strong> 🚀 Campaign relaunched successfully.  
                  <span class="text-sm text-blue-400 block mt-1">(POST /api/sourcing/campaigns/:id/relaunch → event: campaign_relaunched)</span>
                </div>
              </div>
              <div class="text-right mt-3">
                <button class="tryRex bg-blue-800 hover:bg-blue-700 text-sm text-white px-3 py-1 rounded-md"
                  data-command="Relaunch my ‘AE Candidates - Austin’ campaign"
                  data-api="POST /api/sourcing/campaigns/:id/relaunch\n{}"
                  data-event="campaign_relaunched">
                  🧪 Try This in REX Console
                </button>
              </div>
            </div>

            <!-- Clients -->
            <div id="rexClients" class="rex-thread hidden space-y-4">
              <div class="flex flex-col space-y-2">
                <div class="self-start bg-blue-900/40 border border-blue-700 text-blue-100 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>You:</strong> Add Acme Corp as a new client in the CRM.
                </div>
                <div class="self-end bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>REX:</strong> 🧩 Client Acme Corp created successfully.  
                  <span class="text-sm text-blue-400 block mt-1">(POST /api/clients → event: client_created)</span>
                </div>
              </div>
              <div class="text-right mt-3">
                <button class="tryRex bg-blue-800 hover:bg-blue-700 text-sm text-white px-3 py-1 rounded-md"
                  data-command="Create client Acme Corp in CRM"
                  data-api="POST /api/clients\n{\n  'name': 'Acme Corp'\n}"
                  data-event="client_created">
                  🧪 Try This in REX Console
                </button>
              </div>

              <div class="flex flex-col space-y-2">
                <div class="self-start bg-blue-900/40 border border-blue-700 text-blue-100 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>You:</strong> Sync enrichment for Acme Corp.
                </div>
                <div class="self-end bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>REX:</strong> 🔍 Client enriched with latest data (funding, size, tech stack).  
                  <span class="text-sm text-blue-400 block mt-1">(POST /api/clients/:id/sync-enrichment → event: client_enriched)</span>
                </div>
              </div>
              <div class="text-right mt-3">
                <button class="tryRex bg-blue-800 hover:bg-blue-700 text-sm text-white px-3 py-1 rounded-md"
                  data-command="Sync enrichment for client Acme Corp"
                  data-api="POST /api/clients/:id/sync-enrichment\n{}"
                  data-event="client_enriched">
                  🧪 Try This in REX Console
                </button>
              </div>
            </div>

            <!-- Sniper -->
            <div id="rexSniper" class="rex-thread hidden space-y-4">
              <div class="flex flex-col space-y-2">
                <div class="self-start bg-blue-900/40 border border-blue-700 text-blue-100 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>You:</strong> Find 10 new VP of Sales prospects in Austin.
                </div>
                <div class="self-end bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>REX:</strong> 🎯 Added 10 new targets to Sniper list.  
                  <span class="text-sm text-blue-400 block mt-1">(POST /api/sniper/targets → event: sniper_target_added)</span>
                </div>
              </div>
              <div class="text-right mt-3">
                <button class="tryRex bg-blue-800 hover:bg-blue-700 text-sm text-white px-3 py-1 rounded-md"
                  data-command="Add 10 new VP of Sales prospects in Austin to Sniper"
                  data-api="POST /api/sniper/targets\n{\n  'count': 10,\n  'role': 'VP of Sales',\n  'location': 'Austin, TX'\n}"
                  data-event="sniper_target_added">
                  🧪 Try This in REX Console
                </button>
              </div>

              <div class="flex flex-col space-y-2">
                <div class="self-start bg-blue-900/40 border border-blue-700 text-blue-100 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>You:</strong> Trigger capture now for target “Globex.”
                </div>
                <div class="self-end bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-2xl max-w-lg">
                  <strong>REX:</strong> ⏱ Capture initiated for Globex (LinkedIn scrape started).  
                  <span class="text-sm text-blue-400 block mt-1">(POST /api/sniper/targets/:id/capture-now → event: sniper_capture_triggered)</span>
                </div>
              </div>
              <div class="text-right mt-3">
                <button class="tryRex bg-blue-800 hover:bg-blue-700 text-sm text-white px-3 py-1 rounded-md"
                  data-command="Capture Globex now"
                  data-api="POST /api/sniper/targets/:id/capture-now\n{}"
                  data-event="sniper_capture_triggered">
                  🧪 Try This in REX Console
                </button>
              </div>
            </div>
          </div>

          <!-- Replay -->
          <div class="text-center mt-8">
            <button id="simulateRexAdaptive" class="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 transition text-sm font-medium">
              ▶ Replay Conversation
            </button>
          </div>
        </section>

        <!-- EXAMPLES -->
        <section id="examples" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
          <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center"><i class="fas fa-code mr-3"></i>Automation Examples</h2>

          <div class="bg-gray-800 border border-gray-700 p-4 rounded-lg text-sm text-white mb-4">
            <h4 class="text-blue-300 mb-2">Zapier Example – Candidate Submitted → Slack Alert</h4>
            <pre>{
  "trigger": "event_type=opportunity_submitted",
  "action": "POST https://hooks.slack.com/...",
  "body": { "text": "🚀 A new candidate was submitted to a client!" }
}</pre>
          </div>

          <div class="bg-gray-800 border border-gray-700 p-4 rounded-lg text-sm text-white">
            <h4 class="text-blue-300 mb-2">Make Example – Campaign Relaunched → Email Notification</h4>
            <pre>{
  "trigger": "event_type=campaign_relaunched",
  "action": "POST /api/notifications",
  "payload": { "message": "Campaign relaunched successfully" }
}</pre>
          </div>
        </section>

        <!-- RATE LIMITS -->
        <section id="rate-limits" class="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
          <h2 class="text-2xl font-semibold text-blue-300 mb-4 flex items-center"><i class="fas fa-tachometer-alt mr-3"></i>Rate Limits</h2>
          <p class="text-gray-400">Each API key is limited to <strong>60 requests/minute</strong>.  
          REX and Zapier share the same limits. Idempotency keys are supported for all POST routes.</p>
        </section>
      </div>
    </div>
  </main>`;

  // Append a global modal container outside of main (rendered as sibling in React root)
  const modalHtml = String.raw`
  <div id="rexModal" class="fixed inset-0 bg-black bg-opacity-60 hidden items-center justify-center z-50 backdrop-blur-sm">
    <div class="bg-gray-900 border border-blue-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4">
      <div class="flex justify-between items-center px-6 py-4 border-b border-blue-700">
        <h3 class="text-lg font-semibold text-blue-300 flex items-center"><i class="fas fa-robot mr-2"></i> REX Console Preview</h3>
        <button id="closeRexModal" class="text-gray-400 hover:text-gray-200"><i class="fas fa-times"></i></button>
      </div>
      <div class="p-6 space-y-4">
        <div>
          <p class="text-sm text-gray-400 mb-1">🧠 <span class="font-semibold text-gray-200">Command</span></p>
          <pre id="rexModalCommand" class="bg-gray-800 text-blue-200 rounded-lg p-3 overflow-x-auto text-sm"></pre>
        </div>
        <div>
          <p class="text-sm text-gray-400 mb-1">💻 <span class="font-semibold text-gray-200">API Call</span></p>
          <pre id="rexModalApi" class="bg-gray-800 text-green-300 rounded-lg p-3 overflow-x-auto text-sm"></pre>
        </div>
        <div>
          <p class="text-sm text-gray-400 mb-1">⚡ <span class="font-semibold text-gray-200">Event Emitted</span></p>
          <pre id="rexModalEvent" class="bg-gray-800 text-purple-300 rounded-lg p-3 overflow-x-auto text-sm"></pre>
        </div>
      </div>
    </div>
  </div>`;

  // Attach interactive behavior for collapsible blocks and copy buttons
  // Since the content is injected via dangerouslySetInnerHTML, we wire events after mount
  useEffect(() => {
    const onToggle = (ev) => {
      const btn = ev.currentTarget;
      const content = btn.nextElementSibling;
      const icon = btn.querySelector('i');
      const expanded = !content.classList.contains('hidden');
      document.querySelectorAll('.toggle-content').forEach((el) => el.classList.add('hidden'));
      document.querySelectorAll('.toggle-btn i').forEach((i) => i.classList.remove('rotate-180'));
      if (!expanded) {
        content.classList.remove('hidden');
        if (icon) icon.classList.add('rotate-180');
      }
    };
    const onCopy = async (ev) => {
      const btn = ev.currentTarget;
      const container = btn.closest('.toggle-content');
      const pre = container ? container.querySelector('pre') : null;
      const text = pre ? pre.textContent : '';
      try {
        if (text) await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = original; }, 1200);
      } catch {}
    };
    const toggleBtns = Array.from(document.querySelectorAll('.toggle-btn'));
    const copyBtns = Array.from(document.querySelectorAll('.copy-btn'));
    // REX adaptive playground handlers
    const tabs = Array.from(document.querySelectorAll('.rex-tab'));
    const threads = Array.from(document.querySelectorAll('.rex-thread'));
    const replayBtn = document.getElementById('simulateRexAdaptive');
    const rexModal = document.getElementById('rexModal');
    const closeRexModal = document.getElementById('closeRexModal');
    const rexCommand = document.getElementById('rexModalCommand');
    const rexApi = document.getElementById('rexModalApi');
    const rexEvent = document.getElementById('rexModalEvent');

    const onTab = (tab) => {
      tabs.forEach((t) => t.classList.remove('active-tab', 'bg-blue-700', 'text-white'));
      tab.classList.add('active-tab', 'bg-blue-700', 'text-white');
      const target = tab.getAttribute('data-target');
      threads.forEach((th) => th.classList.add('hidden'));
      const active = document.getElementById(target);
      if (active) active.classList.remove('hidden');
    };
    const onReplay = () => {
      const visibleThread = document.querySelector('.rex-thread:not(.hidden)');
      if (!visibleThread) return;
      const messages = visibleThread.querySelectorAll('.flex');
      messages.forEach((m) => m.classList.add('opacity-0', 'translate-y-2'));
      let delay = 0;
      for (const m of messages) {
        setTimeout(() => {
          m.classList.remove('opacity-0', 'translate-y-2');
          m.classList.add('transition', 'duration-500', 'ease-out');
        }, delay);
        delay += 800;
      }
    };
    const onTryRex = (ev) => {
      const btn = ev.currentTarget;
      const command = btn.getAttribute('data-command');
      const apiCall = btn.getAttribute('data-api');
      const eventEmitted = btn.getAttribute('data-event');

      rexCommand.textContent = command;
      rexApi.textContent = apiCall;
      rexEvent.textContent = eventEmitted;
      rexModal.classList.remove('hidden');
    };
    const onCloseRexModal = () => {
      rexModal.classList.add('hidden');
    };

    toggleBtns.forEach((b) => b.addEventListener('click', onToggle));
    copyBtns.forEach((b) => b.addEventListener('click', onCopy));
    tabs.forEach((t) => t.addEventListener('click', () => onTab(t)));
    if (replayBtn) replayBtn.addEventListener('click', onReplay);
    const tryBtns = Array.from(document.querySelectorAll('.tryRex'));
    tryBtns.forEach((b) => b.addEventListener('click', () => {
      if (rexCommand) rexCommand.textContent = b.getAttribute('data-command') || '';
      if (rexApi) rexApi.textContent = b.getAttribute('data-api') || '';
      if (rexEvent) rexEvent.textContent = b.getAttribute('data-event') || '';
      if (rexModal) { rexModal.classList.remove('hidden'); rexModal.classList.add('flex'); }
    }));
    if (closeRexModal) closeRexModal.addEventListener('click', () => { if (rexModal) { rexModal.classList.add('hidden'); rexModal.classList.remove('flex'); } });
    if (rexModal) rexModal.addEventListener('click', (e) => { if (e.target === rexModal) { rexModal.classList.add('hidden'); rexModal.classList.remove('flex'); } });
    return () => {
      toggleBtns.forEach((b) => b.removeEventListener('click', onToggle));
      copyBtns.forEach((b) => b.removeEventListener('click', onCopy));
      tabs.forEach((t) => t.removeEventListener('click', () => onTab(t)));
      if (replayBtn) replayBtn.removeEventListener('click', onReplay);
      tryBtns.forEach((b) => b.removeEventListener('click', () => {}));
      if (closeRexModal) closeRexModal.removeEventListener('click', () => {});
      if (rexModal) rexModal.removeEventListener('click', () => {});
    };
  }, []);

  return (
    <div className="bg-gray-950 text-white font-sans">
      <PublicNavbar />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <div dangerouslySetInnerHTML={{ __html: modalHtml }} />
      <PublicFooter />
    </div>
  );
}