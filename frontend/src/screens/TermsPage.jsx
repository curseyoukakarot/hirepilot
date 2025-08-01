import React, { useState } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function TermsPage() {
  const [tab, setTab] = useState('privacy');
  const btnClass = (t) => tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200';

  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-900">
      <PublicNavbar />
      <main className="max-w-4xl mx-auto px-6 pt-32 pb-12">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Privacy Policy & Terms of Service</h1>
          <p className="text-xl text-gray-600">Your privacy and trust are important to us</p>
        </div>

        {/* nav buttons */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <button className={`flex-1 px-6 py-3 rounded-lg font-medium text-center ${btnClass('privacy')}`} onClick={() => setTab('privacy')}>
              <i className="fa-solid fa-shield-halved mr-2" />Privacy Policy
            </button>
            <button className={`flex-1 px-6 py-3 rounded-lg font-medium text-center ${btnClass('terms')}`} onClick={() => setTab('terms')}>
              <i className="fa-solid fa-file-contract mr-2" />Terms of Service
            </button>
          </div>
        </div>

        {tab === 'privacy' && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
            <h2 className="text-3xl font-bold mb-3">HirePilot Privacy Policy</h2>
            <p className="text-gray-600">Effective Date: July 6, 2025</p>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold mb-3">Introduction</h3>
                <p className="text-gray-700">This Privacy Policy explains how HirePilot ("we", "our", or "us") collects, uses, and protects information when you use our platform, including our website, app, Chrome extension, and any connected services.</p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">Information We Collect</h3>
                <p className="text-gray-700 mb-3">We may collect the following types of information:</p>
                <ul className="list-disc ml-6 space-y-2 text-gray-700">
                  <li>Account Information: Name, email address, company, and other signup details.</li>
                  <li>Billing Details via Stripe.</li>
                  <li>Usage Data: feature usage, page visits, etc.</li>
                  <li>Lead & Communication Data you upload or create.</li>
                </ul>
              </div>
              {/* Google OAuth Compliance Sections */}
              <div>
                <h3 className="text-xl font-semibold mb-3">How We Use Google User Data</h3>
                <p className="text-gray-700 mb-3">
                  HirePilot uses the Gmail API to support recruiting workflows initiated by the user. When you connect your Gmail account, we use the access granted to:
                </p>
                <ul className="list-disc ml-6 space-y-2 text-gray-700">
                  <li>Send personalized outreach emails to job candidates on your behalf (<code className="bg-gray-100 px-2 py-1 rounded text-sm">gmail.send</code>)</li>
                  <li>
                  <strong>Gmail Integration:</strong> With your explicit permission, we connect to your Gmail account using Google's OAuth 2.0 to send recruitment emails on your behalf. We only request the minimum necessary permissions: <code className="bg-gray-100 px-2 py-1 rounded text-sm">gmail.send</code> for sending emails, and basic profile information for account authentication.
                </li>
                </ul>
                <p className="text-gray-700 mt-3">
                  We only access emails sent via HirePilot. We do not access, store, or analyze unrelated inbox content, attachments, or personal emails.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Data Sharing & Disclosure</h3>
                <p className="text-gray-700">
                  HirePilot does not sell, share, or transfer your Gmail data to any third party. Access is granted solely for your use of the platform, and only with your explicit permission via Google's OAuth2 process. Your data is never used for advertising, analytics, or external reporting.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Revoking Access</h3>
                <p className="text-gray-700">
                  You may revoke Gmail access at any time from within the HirePilot dashboard or by visiting <a href="https://myaccount.google.com/permissions" target="_blank" className="text-blue-600 hover:underline">https://myaccount.google.com/permissions</a>. Upon disconnection, no further Gmail data is accessed or processed.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">Security & Retention</h3>
                <p className="text-gray-700">We use encryption and best practices to safeguard data. We retain data while your account is active or as required to provide the Service. You can request deletion at any time.</p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">Contact</h3>
                <p className="text-gray-700">For privacy questions, contact <a href="mailto:support@thehirepilot.com" className="text-blue-600 hover:underline">support@thehirepilot.com</a>.</p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">AI/ML Compliance with Google Workspace APIs</h3>
                <p className="text-gray-700">
                  HirePilot uses AI features (e.g., automation and recommendations) to enhance the recruiting workflow. These features do <strong>not</strong> use or train on Gmail or Google Workspace API data. We fully comply with Google's <a href="https://developers.google.com/workspace/workspace-api-user-data-developer-policy#limited-use" target="_blank" className="text-blue-600 hover:underline">Limited Use requirements</a>, as outlined in the Workspace API User Data and Developer Policy.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Use of Google User Data</h3>
                <p className="text-gray-700 mb-3">
                  HirePilot accesses Gmail user data solely to enable users to send emails through their own Gmail accounts from within our platform. We do not read, store, or access any email content beyond what is required to execute the user's request.
                </p>
                <p className="text-gray-700 mb-3">
                  Our use of Gmail and other Workspace APIs strictly adheres to Google's Limited Use requirements, as outlined in the <a href="https://developers.google.com/workspace/workspace-api-user-data-developer-policy" target="_blank" className="text-blue-600 hover:underline">Workspace API User Data and Developer Policy</a>. We do not use or transfer data for serving ads, building profiles, or training generalized AI/ML models.
                </p>
                <p className="text-gray-700">
                  We maintain strong data privacy protections and do not share user data with third parties except as required to perform the requested service.
                </p>
              </div>
            </div>
          </section>
        )}

        {tab === 'terms' && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
            <h2 className="text-3xl font-bold mb-3">HirePilot Terms of Service</h2>
            <p className="text-gray-600">Effective Date: July 6, 2025</p>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold mb-3">1. Overview</h3>
                <p className="text-gray-700">These Terms govern your access to and use of the HirePilot platform ("Service"). By using the Service, you agree to be bound by them.</p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">2. Eligibility</h3>
                <p className="text-gray-700">You must be at least 18 years old and able to form a binding contract to use HirePilot.</p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">3. Subscription & Billing</h3>
                <p className="text-gray-700">Paid plans are billed in advance. Fees are non-refundable. You may cancel anytime in account settings.</p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">4. Acceptable Use</h3>
                <ul className="list-disc ml-6 space-y-2 text-gray-700">
                  <li>No unlawful or fraudulent use.</li>
                  <li>No scraping or reselling of data.</li>
                  <li>No spam or unauthorized communications.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">5. Limitation of Liability</h3>
                <p className="text-gray-700">We are not liable for indirect or consequential damages. Our total liability is limited to fees paid in the last 12 months.</p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3">6. Contact</h3>
                <p className="text-gray-700">Questions about these Terms? Email <a href="mailto:support@thehirepilot.com" className="text-blue-600 hover:underline">support@thehirepilot.com</a>.</p>
              </div>
            </div>
          </section>
        )}
      </main>

      <PublicFooter />
    </div>
  );
} 