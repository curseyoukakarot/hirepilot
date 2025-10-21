import React, { useEffect } from 'react';

export default function PublicFooter() {
  useEffect(() => {
    (function(key) {
      if (typeof window === 'undefined') return;
      if (window.reb2b) return;
      window.reb2b = { loaded: true };
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://ddwl4m2hdecbv.cloudfront.net/b/' + key + '/' + key + '.js.gz';
      var firstScript = document.getElementsByTagName('script')[0];
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(s, firstScript);
      } else {
        document.head.appendChild(s);
      }
    })('VN080HXJK06J');
  }, []);
  return (
    <footer id="footer" className="bg-gray-900 text-white py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
              <span className="text-xl font-bold">HirePilot</span>
            </div>
            <p className="text-gray-400">AI-powered recruiting platform that helps you hire better, faster.</p>
            <div className="mt-6 flex gap-4">
              <span className="text-gray-400 hover:text-white cursor-pointer"><i className="fa-brands fa-linkedin text-xl" /></span>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-lg mb-4">Product</h4>
            <ul className="space-y-3 text-gray-400">
              <li><a href="/rex" className="hover:text-white">Meet REX</a></li>
              <li><a href="/copilot" className="hover:text-white">Your Recruiting Co-Pilot</a></li>
              <li><a href="/enterprise" className="hover:text-white">Enterprise</a></li>
              <li><a href="/chromeextension" className="hover:text-white">Chrome Extension</a></li>
              <li><a href="/freeforever" className="hover:text-white">Free Forever</a></li>
              <li><a href="/pricing" className="hover:text-white">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-lg mb-4">Company</h4>
            <ul className="space-y-3 text-gray-400">
              <li><a href="/blog" className="hover:text-white">Blog</a></li>
              <li><a href="/affiliates" className="hover:text-white">Earn Money</a></li>
              <li><a href="/producthunt" className="hover:text-white">Product Hunt Launch</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-lg mb-4">Support</h4>
            <ul className="space-y-3 text-gray-400">
              <li><a href="/terms" className="hover:text-white cursor-pointer">Terms of Use</a></li>
              <li><a href="/rexsupport" className="hover:text-white cursor-pointer">REX Support</a></li>
              <li>
                <a href="/workflows" className="hover:text-white cursor-pointer">Workflows</a>
              </li>
              <li><a href="/apidoc" className="hover:text-white cursor-pointer">API Documentation</a></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">© 2025 HirePilot. All rights reserved.</div>
      </div>
    </footer>
  );
} 