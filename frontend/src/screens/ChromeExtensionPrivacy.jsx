import React, { useState } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter.jsx';

export default function ChromeExtensionPrivacy() {
  const [tab, setTab] = useState('privacy');

  const isActive = (t) => tab === t ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500 hover:text-blue-600';

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans">
      <PublicNavbar />

      {/* Hero */}
      <section id="hero" className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white h-[400px] flex items-center pt-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <i className="fa-solid fa-shield-halved text-6xl mb-6 opacity-90" />
          <h1 className="text-4xl font-bold mb-4">Privacy Policy &amp; Terms</h1>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            Transparent policies for our Chrome Extension that respects your privacy and data security
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="bg-white border-b border-gray-200 sticky top-20 z-40">
        <div className="max-w-6xl mx-auto px-6 flex space-x-8">
          <button className={`py-4 px-2 ${isActive('privacy')}`} onClick={() => setTab('privacy')}>
            <i className="fa-solid fa-lock mr-2" />Privacy Policy
          </button>
          <button className={`py-4 px-2 ${isActive('terms')}`} onClick={() => setTab('terms')}>
            <i className="fa-solid fa-file-contract mr-2" />Terms of Service
          </button>
        </div>
      </section>

      {/* Privacy Policy */}
      {tab === 'privacy' && (
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Privacy Policy</h2>
                <p className="text-gray-500">Effective Date: July 6, 2025</p>
              </div>
              <div className="space-y-8 leading-relaxed text-gray-700">
                <div className="border-l-4 border-blue-600 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-info-circle text-blue-600 mr-3" />Introduction</h3>
                  <p>The HirePilot Chrome Extension ("we", "us", or "our") helps users retrieve their LinkedIn <code className="font-mono bg-gray-100 px-1 rounded">li_at</code> session cookie to enable sourcing and outreach functionality in the HirePilot platform. We are committed to respecting your privacy and data.</p>
                </div>
                <div className="border-l-4 border-cyan-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-cog text-cyan-500 mr-3" />What This Extension Does</h3>
                  <ul className="space-y-2 list-disc ml-6">
                    <li>Only accesses the <code className="font-mono">li_at</code> session cookie from LinkedIn after you click to activate it.</li>
                    <li>Copies the cookie to your clipboard so you can paste it into HirePilot manually.</li>
                    <li>Does not log, transmit, or store any data.</li>
                  </ul>
                </div>
                <div className="border-l-4 border-green-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-database text-green-500 mr-3" />Data Handling</h3>
                  <ul className="space-y-2 list-disc ml-6">
                    <li>This extension does not collect any personal data.</li>
                    <li>It does not transmit any information over the internet.</li>
                    <li>The cookie never leaves your browser or clipboard.</li>
                    <li>No tracking, monitoring, or background execution occurs.</li>
                  </ul>
                </div>
                <div className="border-l-4 border-orange-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-key text-orange-500 mr-3" />Permissions</h3>
                  <ul className="space-y-2 list-disc ml-6">
                    <li>Requires access only to <code className="font-mono">https://*.linkedin.com/*</code> to retrieve the session cookie.</li>
                    <li>Does not request or use permissions beyond this scope.</li>
                  </ul>
                </div>
                <div className="border-l-4 border-purple-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-edit text-purple-500 mr-3" />Changes to This Policy</h3>
                  <p>We may update this Privacy Policy. Any changes will be posted on this page with a revised effective date.</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-envelope text-blue-500 mr-3" />Contact</h3>
                  <p>For questions about this policy, email us at <a href="mailto:support@thehirepilot.com" className="text-blue-600 hover:underline">support@thehirepilot.com</a>.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Terms of Service */}
      {tab === 'terms' && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Terms of Service</h2>
                <p className="text-gray-500">Effective Date: July 6, 2025</p>
              </div>
              <div className="space-y-8 leading-relaxed text-gray-700">
                <div className="border-l-4 border-blue-600 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-eye text-blue-600 mr-3" />Overview</h3>
                  <p>The HirePilot Chrome Extension ("Extension") is designed to help users capture their LinkedIn session cookie (<code className="font-mono">li_at</code>) for use within the HirePilot web platform.</p>
                </div>
                <div className="border-l-4 border-green-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-certificate text-green-500 mr-3" />License</h3>
                  <p>We grant you a limited, non-exclusive license to use the Extension solely in conjunction with HirePilot's services. You may not copy, modify, reverse-engineer, or distribute the Extension.</p>
                </div>
                <div className="border-l-4 border-orange-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-user-check text-orange-500 mr-3" />Acceptable Use</h3>
                  <p className="mb-3">You agree not to:</p>
                  <ul className="space-y-2 list-disc ml-6">
                    <li>Use the Extension for any purpose other than retrieving your own LinkedIn cookie.</li>
                    <li>Interfere with LinkedIn's Terms of Service.</li>
                    <li>Use the Extension in any automated, malicious, or unauthorized manner.</li>
                  </ul>
                </div>
                <div className="border-l-4 border-yellow-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-exclamation-triangle text-yellow-500 mr-3" />No Warranty</h3>
                  <p>The Extension is provided "as is" without warranties. We do not guarantee it will always work or remain compatible with third-party changes.</p>
                </div>
                <div className="border-l-4 border-red-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-balance-scale text-red-500 mr-3" />Limitation of Liability</h3>
                  <p>We are not liable for any damages arising from your use or misuse of the Extension. You assume full responsibility for its use.</p>
                </div>
                <div className="border-l-4 border-purple-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-sync text-purple-500 mr-3" />Updates</h3>
                  <p>We may update this Extension or these Terms at any time. Continued use after updates constitutes your acceptance of the revised Terms.</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-envelope text-blue-500 mr-3" />Contact</h3>
                  <p>Questions about these Terms? Contact <a href="mailto:support@thehirepilot.com" className="text-blue-600 hover:underline">support@thehirepilot.com</a>.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <PublicFooter />
    </div>
  );
} 