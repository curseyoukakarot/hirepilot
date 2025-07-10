import React from "react";

const TestGmail: React.FC = () => {
  // Use environment variables for the OAuth configuration
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://thehirepilot.com";
  const redirectUri = `${backendUrl}/api/auth/google/callback`;
  const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly email profile");
  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=test-user`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto text-center">
        <div className="flex items-center justify-center mb-8">
          <img src="/logo.png" alt="HirePilot Logo" className="h-12 w-12 mr-4" />
          <h1 className="text-4xl font-bold text-gray-900">HirePilot</h1>
        </div>
        
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Gmail OAuth Test</h2>
        
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <p className="text-gray-600 mb-6 text-lg leading-relaxed">
            This page allows Google reviewers to test the Gmail OAuth flow used in our application.
            Click the button below to initiate the OAuth consent screen and review the requested permissions.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Requested Scopes:</h3>
            <ul className="text-blue-800 text-sm space-y-1 text-left">
              <li>• <code>gmail.send</code> - Send emails on behalf of the user</li>
              <li>• <code>gmail.readonly</code> - Read Gmail messages and metadata</li>
              <li>• <code>email</code> - Access user's email address</li>
              <li>• <code>profile</code> - Access basic profile information</li>
            </ul>
          </div>
          
          <a
            href={oauthUrl}
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            Connect Gmail (Test OAuth Flow)
          </a>
          
          <div className="mt-6 text-sm text-gray-500">
            <p>
              <strong>Note:</strong> This is a test page for Google OAuth verification.
              The OAuth flow will redirect to our callback endpoint after consent.
            </p>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-6 text-left">
          <h3 className="font-semibold text-gray-800 mb-3">Technical Details:</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Client ID:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{clientId}</code></p>
            <p><strong>Redirect URI:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{redirectUri}</code></p>
            <p><strong>Response Type:</strong> <code className="bg-gray-100 px-2 py-1 rounded">code</code></p>
            <p><strong>Access Type:</strong> <code className="bg-gray-100 px-2 py-1 rounded">offline</code></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestGmail; 