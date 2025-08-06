import React, { useState } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

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
            Comprehensive policies for our LinkedIn Assistant Extension - covering cookie management, lead extraction, and data security
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
                <p className="text-gray-500">Effective Date: August 6, 2025</p>
              </div>
              <div className="space-y-8 leading-relaxed text-gray-700">
                <div className="border-l-4 border-blue-600 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-info-circle text-blue-600 mr-3" />Overview</h3>
                  <p>The HirePilot LinkedIn Assistant Chrome Extension helps recruitment professionals streamline their LinkedIn workflows by securely capturing LinkedIn authentication data and extracting publicly available lead information from LinkedIn Sales Navigator. We are committed to respecting your privacy and data security.</p>
                </div>
                
                <div className="border-l-4 border-cyan-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-cog text-cyan-500 mr-3" />What Our Extension Does</h3>
                  <ul className="space-y-2 list-disc ml-6">
                    <li>Securely captures your complete LinkedIn session cookies (including <code className="font-mono bg-gray-100 px-1 rounded">li_at</code>, <code className="font-mono bg-gray-100 px-1 rounded">JSESSIONID</code>, and other authentication tokens)</li>
                    <li>Extracts publicly visible leads from LinkedIn Sales Navigator search results</li>
                    <li>Integrates seamlessly with your HirePilot recruitment platform</li>
                    <li>Provides secure authentication between LinkedIn and HirePilot services</li>
                  </ul>
                </div>

                <div className="border-l-4 border-green-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-database text-green-500 mr-3" />Information We Collect</h3>
                  
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">1. LinkedIn Authentication Data</h4>
                    <ul className="space-y-1 list-disc ml-6 text-sm">
                      <li><strong>What:</strong> Complete LinkedIn session cookies from your browser</li>
                      <li><strong>When:</strong> Only when you click "Upload Full LinkedIn Cookie"</li>
                      <li><strong>Purpose:</strong> Maintain your LinkedIn session and authenticate with HirePilot</li>
                    </ul>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">2. Sales Navigator Lead Data</h4>
                    <ul className="space-y-1 list-disc ml-6 text-sm">
                      <li><strong>What:</strong> Names, titles, companies, locations, and LinkedIn profile URLs</li>
                      <li><strong>When:</strong> Only when you click "Scrape Sales Nav Leads" on search result pages</li>
                      <li><strong>Purpose:</strong> Import leads into your HirePilot recruitment pipeline</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">3. User Authentication</h4>
                    <ul className="space-y-1 list-disc ml-6 text-sm">
                      <li><strong>What:</strong> Your email and HirePilot authentication tokens</li>
                      <li><strong>When:</strong> When you log into the extension</li>
                      <li><strong>Purpose:</strong> Connect with your HirePilot account securely</li>
                    </ul>
                  </div>
                </div>

                <div className="border-l-4 border-orange-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-shield-alt text-orange-500 mr-3" />Your Control Over Data</h3>
                  <ul className="space-y-2 list-disc ml-6">
                    <li><strong>Explicit Consent:</strong> All data collection requires your explicit button clicks</li>
                    <li><strong>No Background Collection:</strong> No automatic or hidden data gathering</li>
                    <li><strong>User Choice:</strong> You decide when to upload cookies or scrape leads</li>
                    <li><strong>Easy Removal:</strong> Uninstall the extension to remove all local data</li>
                    <li><strong>Account Control:</strong> Manage imported data through your HirePilot dashboard</li>
                  </ul>
                </div>

                <div className="border-l-4 border-yellow-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-key text-yellow-500 mr-3" />Permissions & Security</h3>
                  <ul className="space-y-2 list-disc ml-6">
                    <li><strong>LinkedIn Access:</strong> Required to access LinkedIn pages for cookie extraction and lead scraping</li>
                    <li><strong>Cookie Permission:</strong> Necessary to capture LinkedIn session cookies including HttpOnly cookies</li>
                    <li><strong>Storage Permission:</strong> Store authentication tokens securely in your browser</li>
                    <li><strong>HTTPS Encryption:</strong> All data transmission uses secure encryption</li>
                    <li><strong>Local Storage:</strong> Authentication data stored securely in your browser only</li>
                  </ul>
                </div>

                <div className="border-l-4 border-red-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-exclamation-triangle text-red-500 mr-3" />LinkedIn Compliance</h3>
                  <ul className="space-y-2 list-disc ml-6">
                    <li>Only accesses publicly visible profile information from LinkedIn</li>
                    <li>Respects LinkedIn's rate limiting through human-like interaction patterns</li>
                    <li>Does not circumvent LinkedIn's security measures</li>
                    <li>Users remain responsible for compliance with LinkedIn's Terms of Service</li>
                  </ul>
                </div>

                <div className="border-l-4 border-purple-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-edit text-purple-500 mr-3" />Changes to This Policy</h3>
                  <p>We may update this Privacy Policy to reflect changes in our extension functionality or legal requirements. Material changes will be communicated through extension notifications or email. Continued use after changes constitutes acceptance of the revised policy.</p>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-envelope text-blue-500 mr-3" />Contact Us</h3>
                  <p>For questions about this privacy policy or our data practices:</p>
                  <ul className="space-y-1 list-none ml-0 mt-2">
                    <li><strong>Privacy Questions:</strong> <a href="mailto:privacy@thehirepilot.com" className="text-blue-600 hover:underline">privacy@thehirepilot.com</a></li>
                    <li><strong>Technical Support:</strong> <a href="mailto:support@thehirepilot.com" className="text-blue-600 hover:underline">support@thehirepilot.com</a></li>
                    <li><strong>General Inquiries:</strong> <a href="mailto:contact@thehirepilot.com" className="text-blue-600 hover:underline">contact@thehirepilot.com</a></li>
                  </ul>
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
                <p className="text-gray-500">Effective Date: August 6, 2025</p>
              </div>
              <div className="space-y-8 leading-relaxed text-gray-700">
                <div className="border-l-4 border-blue-600 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-eye text-blue-600 mr-3" />Overview</h3>
                  <p>The HirePilot LinkedIn Assistant Chrome Extension ("Extension") helps recruitment professionals streamline their LinkedIn workflows by securely capturing LinkedIn authentication data and extracting publicly available lead information from LinkedIn Sales Navigator for use within the HirePilot platform.</p>
                </div>

                <div className="border-l-4 border-cyan-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-cog text-cyan-500 mr-3" />Extension Features</h3>
                  <ul className="space-y-2 list-disc ml-6">
                    <li>Capture complete LinkedIn session cookies (including <code className="font-mono bg-gray-100 px-1 rounded">li_at</code>, <code className="font-mono bg-gray-100 px-1 rounded">JSESSIONID</code>, and other authentication tokens)</li>
                    <li>Extract publicly visible lead information from LinkedIn Sales Navigator search results</li>
                    <li>Securely authenticate and integrate with your HirePilot account</li>
                    <li>Facilitate recruitment workflows and candidate management</li>
                  </ul>
                </div>

                <div className="border-l-4 border-green-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-certificate text-green-500 mr-3" />License & Usage Rights</h3>
                  <p className="mb-3">We grant you a limited, non-exclusive, non-transferable license to use the Extension solely for legitimate recruitment and business development activities in conjunction with HirePilot's services.</p>
                  <p><strong>You may not:</strong> copy, modify, reverse-engineer, distribute, or create derivative works of the Extension.</p>
                </div>

                <div className="border-l-4 border-orange-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-user-check text-orange-500 mr-3" />Your Responsibilities</h3>
                  <div className="mb-3">
                    <h4 className="font-semibold text-gray-800 mb-2">LinkedIn Account Requirements:</h4>
                    <ul className="space-y-1 list-disc ml-6 text-sm">
                      <li>You must have a valid LinkedIn account and appropriate LinkedIn subscription</li>
                      <li>You are responsible for compliance with LinkedIn's Terms of Service</li>
                      <li>You warrant that you have the right to use LinkedIn for business recruitment</li>
                    </ul>
                  </div>
                  <div className="mb-3">
                    <h4 className="font-semibold text-gray-800 mb-2">Appropriate Use:</h4>
                    <ul className="space-y-1 list-disc ml-6 text-sm">
                      <li>Use only for legitimate recruitment and business development activities</li>
                      <li>Respect the privacy and rights of LinkedIn users</li>
                      <li>Ensure compliance with applicable employment and privacy laws</li>
                      <li>Do not spam, harass, or inappropriately contact LinkedIn users</li>
                    </ul>
                  </div>
                </div>

                <div className="border-l-4 border-red-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-ban text-red-500 mr-3" />Prohibited Uses</h3>
                  <p className="mb-3">You may not use the Extension to:</p>
                  <ul className="space-y-2 list-disc ml-6">
                    <li>Violate any applicable laws, regulations, or third-party rights</li>
                    <li>Collect data for non-recruitment or non-business purposes</li>
                    <li>Attempt to circumvent LinkedIn's security measures or rate limits</li>
                    <li>Share your HirePilot account credentials with unauthorized users</li>
                    <li>Use for competitive intelligence against HirePilot or its customers</li>
                    <li>Reverse engineer or attempt to extract the source code</li>
                  </ul>
                </div>

                <div className="border-l-4 border-yellow-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-exclamation-triangle text-yellow-500 mr-3" />Disclaimers & Warranties</h3>
                  <ul className="space-y-2 list-disc ml-6">
                    <li>The Extension is provided "as is" without warranties of any kind</li>
                    <li>We do not guarantee continuous, uninterrupted, or error-free operation</li>
                    <li>LinkedIn changes may affect Extension functionality</li>
                    <li>We do not warrant the accuracy of extracted LinkedIn profile data</li>
                    <li>You should verify candidate information independently</li>
                  </ul>
                </div>

                <div className="border-l-4 border-purple-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-balance-scale text-purple-500 mr-3" />Limitation of Liability</h3>
                  <p className="mb-3">To the maximum extent permitted by law:</p>
                  <ul className="space-y-2 list-disc ml-6">
                    <li>HirePilot shall not be liable for indirect, incidental, or consequential damages</li>
                    <li>Our total liability shall not exceed the amount paid for HirePilot services in the 12 months preceding the claim</li>
                    <li>We are not liable for LinkedIn Terms of Service violations by users</li>
                    <li>You assume full responsibility for appropriate use of extracted data</li>
                  </ul>
                </div>

                <div className="border-l-4 border-indigo-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-sync text-indigo-500 mr-3" />Updates & Modifications</h3>
                  <p className="mb-3">We may update the Extension or these Terms at any time to:</p>
                  <ul className="space-y-2 list-disc ml-6">
                    <li>Maintain functionality and security</li>
                    <li>Comply with legal requirements</li>
                    <li>Add new features or capabilities</li>
                    <li>Address LinkedIn platform changes</li>
                  </ul>
                  <p className="mt-3">Continued use after updates constitutes your acceptance of the revised Terms.</p>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <h3 className="text-xl font-semibold flex items-center mb-3"><i className="fa-solid fa-envelope text-blue-500 mr-3" />Contact & Support</h3>
                  <p>For questions about these Terms or technical support:</p>
                  <ul className="space-y-1 list-none ml-0 mt-2">
                    <li><strong>Legal Questions:</strong> <a href="mailto:legal@thehirepilot.com" className="text-blue-600 hover:underline">legal@thehirepilot.com</a></li>
                    <li><strong>Technical Support:</strong> <a href="mailto:support@thehirepilot.com" className="text-blue-600 hover:underline">support@thehirepilot.com</a></li>
                    <li><strong>General Inquiries:</strong> <a href="mailto:contact@thehirepilot.com" className="text-blue-600 hover:underline">contact@thehirepilot.com</a></li>
                  </ul>
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