import React from 'react';

export default function BlogLandingPage() {
  return (
    <>
      {/* Component-scoped helper styles to preserve original effects */}
      <style>{`
        /* Hide default scrollbar */
        ::-webkit-scrollbar { display: none; }
        /* Custom fonts are loaded globally – just keep font-family reference here */
        body { font-family: 'Inter', sans-serif; }
        /* Effects ported from original stylesheet */
        .search-glow { box-shadow: 0 0 20px rgba(139, 92, 246, 0.2); }
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-8px); box-shadow: 0 25px 50px -12px rgba(139, 92, 246, 0.3); }
      `}</style>

      {/* Header */}
      <header id="header" className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <i className="fa-solid fa-rocket text-violet-600 text-2xl" />
              <span className="text-xl font-bold text-gray-900">HirePilot</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <span className="text-gray-600 hover:text-gray-900 transition cursor-pointer">Home</span>
              <span className="text-violet-600 font-medium cursor-pointer">Blog</span>
              <span className="text-gray-600 hover:text-gray-900 transition cursor-pointer">Features</span>
              <span className="text-gray-600 hover:text-gray-900 transition cursor-pointer">Pricing</span>
              <button className="bg-gradient-to-r from-blue-500 to-violet-600 px-6 py-2 rounded-xl font-medium hover:from-blue-600 hover:to-violet-700 transition text-white">
                Get Started
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main */}
      <main id="blog-main" className="min-h-screen">
        {/* Hero */}
        <section id="blog-hero" className="bg-gradient-to-br from-gray-50 via-white to-gray-50 py-20">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              The HirePilot Blog
            </h1>
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
              Tips, tools, and automation insights for modern recruiters
            </p>

            {/* Search */}
            <div id="search-container" className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search articles..."
                  className="w-full px-6 py-4 bg-white border-2 border-violet-200 rounded-2xl text-gray-900 placeholder-gray-500 focus:outline-none focus:border-violet-500 search-glow text-lg shadow-sm"
                />
                <i className="fa-solid fa-search absolute right-6 top-1/2 -translate-y-1/2 text-violet-500 text-xl" />
              </div>
            </div>

            {/* Filter pills */}
            <div id="filter-pills" className="flex flex-wrap justify-center gap-3">
              <button className="px-6 py-2 bg-violet-600 text-white rounded-xl font-medium shadow-sm">All</button>
              <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition">Getting Started</button>
              <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition">Campaigns</button>
              <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition">Leads</button>
              <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition">Automation</button>
              <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition">Integrations</button>
              <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition">Growth Tips</button>
            </div>
          </div>
        </section>

        {/* Articles grid */}
        <section id="articles-grid" className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Article 1 */}
              <article id="article-1" className="bg-white rounded-2xl overflow-hidden card-hover shadow-lg">
                <div className="h-48 bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                  <i className="fa-solid fa-robot text-white text-4xl" />
                </div>
                <div className="p-6">
                  <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-lg text-sm font-medium">Automation</span>
                  <h3 className="text-xl font-bold mt-4 mb-3 line-clamp-2 text-gray-900">10 AI-Powered Recruiting Strategies That Actually Work</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">Discover how leading recruiters are using artificial intelligence to streamline their hiring process and find better candidates faster.</p>
                  <div className="flex items-center space-x-3">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" alt="Author avatar" className="w-8 h-8 rounded-full" />
                    <div className="text-sm">
                      <p className="text-gray-900 font-medium">Sarah Chen</p>
                      <p className="text-gray-500">Dec 15, 2024</p>
                    </div>
                  </div>
                </div>
              </article>

              {/* Article 2 */}
              <article id="article-2" className="bg-white rounded-2xl overflow-hidden card-hover shadow-lg">
                <div className="h-48 bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
                  <i className="fa-solid fa-chart-line text-white text-4xl" />
                </div>
                <div className="p-6">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">Growth Tips</span>
                  <h3 className="text-xl font-bold mt-4 mb-3 line-clamp-2 text-gray-900">How to Scale Your Recruiting Agency from 10 to 100 Placements</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">A comprehensive guide to building systems, processes, and teams that can handle exponential growth in your recruiting business.</p>
                  <div className="flex items-center space-x-3">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" alt="Author avatar" className="w-8 h-8 rounded-full" />
                    <div className="text-sm">
                      <p className="text-gray-900 font-medium">Marcus Johnson</p>
                      <p className="text-gray-500">Dec 12, 2024</p>
                    </div>
                  </div>
                </div>
              </article>

              {/* Article 3 */}
              <article id="article-3" className="bg-white rounded-2xl overflow-hidden card-hover shadow-lg">
                <div className="h-48 bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <i className="fa-solid fa-envelope text-white text-4xl" />
                </div>
                <div className="p-6">
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">Campaigns</span>
                  <h3 className="text-xl font-bold mt-4 mb-3 line-clamp-2 text-gray-900">Email Templates That Get 80% Response Rates</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">Copy-paste email templates and outreach strategies that top recruiters use to connect with passive candidates.</p>
                  <div className="flex items-center space-x-3">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg" alt="Author avatar" className="w-8 h-8 rounded-full" />
                    <div className="text-sm">
                      <p className="text-gray-900 font-medium">Emily Rodriguez</p>
                      <p className="text-gray-500">Dec 10, 2024</p>
                    </div>
                  </div>
                </div>
              </article>

              {/* Article 4 */}
              <article id="article-4" className="bg-white rounded-2xl overflow-hidden card-hover shadow-lg">
                <div className="h-48 bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <i className="fa-solid fa-users text-white text-4xl" />
                </div>
                <div className="p-6">
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">Leads</span>
                  <h3 className="text-xl font-bold mt-4 mb-3 line-clamp-2 text-gray-900">The Ultimate Guide to LinkedIn Lead Generation</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">Master LinkedIn's algorithm and turn your profile into a lead generation machine with these proven strategies.</p>
                  <div className="flex items-center space-x-3">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-9.jpg" alt="Author avatar" className="w-8 h-8 rounded-full" />
                    <div className="text-sm">
                      <p className="text-gray-900 font-medium">David Kim</p>
                      <p className="text-gray-500">Dec 8, 2024</p>
                    </div>
                  </div>
                </div>
              </article>

              {/* Article 5 */}
              <article id="article-5" className="bg-white rounded-2xl overflow-hidden card-hover shadow-lg">
                <div className="h-48 bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                  <i className="fa-solid fa-puzzle-piece text-white text-4xl" />
                </div>
                <div className="p-6">
                  <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium">Integrations</span>
                  <h3 className="text-xl font-bold mt-4 mb-3 line-clamp-2 text-gray-900">Connect Your ATS with HirePilot in 5 Minutes</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">Step-by-step integration guide for popular ATS platforms including Greenhouse, Lever, and BambooHR.</p>
                  <div className="flex items-center space-x-3">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg" alt="Author avatar" className="w-8 h-8 rounded-full" />
                    <div className="text-sm">
                      <p className="text-gray-900 font-medium">Lisa Park</p>
                      <p className="text-gray-500">Dec 5, 2024</p>
                    </div>
                  </div>
                </div>
              </article>

              {/* Article 6 */}
              <article id="article-6" className="bg-white rounded-2xl overflow-hidden card-hover shadow-lg">
                <div className="h-48 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <i className="fa-solid fa-rocket text-white text-4xl" />
                </div>
                <div className="p-6">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium">Getting Started</span>
                  <h3 className="text-xl font-bold mt-4 mb-3 line-clamp-2 text-gray-900">Your First Week with HirePilot: A Complete Setup Guide</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">Everything you need to know to get started with automated recruiting and see results in your first week.</p>
                  <div className="flex items-center space-x-3">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="Author avatar" className="w-8 h-8 rounded-full" />
                    <div className="text-sm">
                      <p className="text-gray-900 font-medium">Alex Thompson</p>
                      <p className="text-gray-500">Dec 3, 2024</p>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Pagination */}
        <section id="pagination" className="py-12 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <button className="bg-gradient-to-r from-blue-500 to-violet-600 px-8 py-3 rounded-xl font-medium hover:from-blue-600 hover:to-violet-700 transition text-lg text-white">
              Load More Articles
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="footer" className="bg-gray-800 border-t border-gray-700 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <i className="fa-solid fa-rocket text-violet-400 text-xl" />
                <span className="text-lg font-bold">HirePilot</span>
              </div>
              <p className="text-gray-400">Automate your recruiting process and find better candidates faster.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <div className="space-y-2">
                <span className="block text-gray-400 hover:text-white transition cursor-pointer">Features</span>
                <span className="block text-gray-400 hover:text-white transition cursor-pointer">Pricing</span>
                <span className="block text-gray-400 hover:text-white transition cursor-pointer">Integrations</span>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <div className="space-y-2">
                <span className="block text-gray-400 hover:text-white transition cursor-pointer">Blog</span>
                <span className="block text-gray-400 hover:text-white transition cursor-pointer">Help Center</span>
                <span className="block text-gray-400 hover:text-white transition cursor-pointer">API Docs</span>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <div className="space-y-2">
                <span className="block text-gray-400 hover:text-white transition cursor-pointer">About</span>
                <span className="block text-gray-400 hover:text-white transition cursor-pointer">Contact</span>
                <span className="block text-gray-400 hover:text-white transition cursor-pointer">Privacy</span>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>© 2024 HirePilot. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
} 