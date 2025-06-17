import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo.png" alt="HirePilot" className="h-8 w-auto" />
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login" className="text-gray-600 hover:text-gray-900">Login</Link>
            <Link to="/signup" className="bg-hpBlue text-white px-4 py-2 rounded-lg hover:bg-blue-600">Get Started</Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
              <span className="block">Hire Better,</span>
              <span className="block text-hpBlue">Faster with AI</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              Automate your recruiting process with AI-powered candidate screening, interview scheduling, and more.
            </p>
            <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
              <div className="rounded-md shadow">
                <Link to="/signup" className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-hpBlue hover:bg-blue-600 md:py-4 md:text-lg md:px-10">
                  Get Started
                </Link>
              </div>
              <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                <Link to="/pricing" className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-hpBlue bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10">
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-base font-semibold text-gray-500 tracking-wide uppercase">Trusted By</h2>
            <div className="mt-6 grid grid-cols-2 gap-8 md:grid-cols-6 lg:grid-cols-5">
              <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                <img className="h-12" src="/logos/company1.png" alt="Company 1" />
              </div>
              <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                <img className="h-12" src="/logos/company2.png" alt="Company 2" />
              </div>
              <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                <img className="h-12" src="/logos/company3.png" alt="Company 3" />
              </div>
              <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                <img className="h-12" src="/logos/company4.png" alt="Company 4" />
              </div>
              <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                <img className="h-12" src="/logos/company5.png" alt="Company 5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Our AI-powered platform streamlines your entire recruiting process
            </p>
          </div>

          <div className="mt-10">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {/* Step 1 */}
              <div className="text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-hpBlue text-white mx-auto">
                  <i className="fas fa-robot text-xl"></i>
                </div>
                <h3 className="mt-6 text-xl font-medium text-gray-900">AI Screening</h3>
                <p className="mt-2 text-base text-gray-500">
                  Our AI analyzes resumes and profiles to identify the best candidates
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-hpBlue text-white mx-auto">
                  <i className="fas fa-calendar-alt text-xl"></i>
                </div>
                <h3 className="mt-6 text-xl font-medium text-gray-900">Smart Scheduling</h3>
                <p className="mt-2 text-base text-gray-500">
                  Automatically schedule interviews and follow-ups with candidates
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-hpBlue text-white mx-auto">
                  <i className="fas fa-chart-line text-xl"></i>
                </div>
                <h3 className="mt-6 text-xl font-medium text-gray-900">Analytics</h3>
                <p className="mt-2 text-base text-gray-500">
                  Track your hiring metrics and optimize your process
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Features
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Everything you need to streamline your hiring process
            </p>
          </div>

          <div className="mt-10">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-hpBlue rounded-md p-3">
                      <i className="fas fa-search text-white text-xl"></i>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <h3 className="text-lg font-medium text-gray-900">Smart Candidate Search</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Find the perfect candidates with our AI-powered search
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-hpBlue rounded-md p-3">
                      <i className="fas fa-comments text-white text-xl"></i>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <h3 className="text-lg font-medium text-gray-900">Automated Messaging</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Keep candidates engaged with personalized messages
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-hpBlue rounded-md p-3">
                      <i className="fas fa-tasks text-white text-xl"></i>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <h3 className="text-lg font-medium text-gray-900">Pipeline Management</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Track candidates through your hiring pipeline
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              What Our Customers Say
            </h2>
          </div>

          <div className="mt-10">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {/* Testimonial 1 */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center">
                  <img className="h-12 w-12 rounded-full" src="/testimonials/person1.jpg" alt="Person 1" />
                  <div className="ml-4">
                    <h4 className="text-lg font-medium text-gray-900">John Doe</h4>
                    <p className="text-sm text-gray-500">HR Director, Tech Corp</p>
                  </div>
                </div>
                <p className="mt-4 text-gray-500">
                  "HirePilot has revolutionized our hiring process. We've reduced our time-to-hire by 50%."
                </p>
              </div>

              {/* Testimonial 2 */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center">
                  <img className="h-12 w-12 rounded-full" src="/testimonials/person2.jpg" alt="Person 2" />
                  <div className="ml-4">
                    <h4 className="text-lg font-medium text-gray-900">Jane Smith</h4>
                    <p className="text-sm text-gray-500">Talent Acquisition, StartupX</p>
                  </div>
                </div>
                <p className="mt-4 text-gray-500">
                  "The AI screening feature has helped us find better candidates faster than ever before."
                </p>
              </div>

              {/* Testimonial 3 */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center">
                  <img className="h-12 w-12 rounded-full" src="/testimonials/person3.jpg" alt="Person 3" />
                  <div className="ml-4">
                    <h4 className="text-lg font-medium text-gray-900">Mike Johnson</h4>
                    <p className="text-sm text-gray-500">CEO, GrowthCo</p>
                  </div>
                </div>
                <p className="mt-4 text-gray-500">
                  "HirePilot has been a game-changer for our growing team. Highly recommended!"
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-hpBlue">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            <span className="block">Ready to get started?</span>
            <span className="block text-blue-200">Start your free trial today.</span>
          </h2>
          <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
            <div className="inline-flex rounded-md shadow">
              <Link to="/signup" className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-hpBlue bg-white hover:bg-blue-50">
                Get started
              </Link>
            </div>
            <div className="ml-3 inline-flex rounded-md shadow">
              <Link to="/contact" className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                Contact sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Product</h3>
              <ul className="mt-4 space-y-4">
                <li><Link to="/features" className="text-base text-gray-300 hover:text-white">Features</Link></li>
                <li><Link to="/pricing" className="text-base text-gray-300 hover:text-white">Pricing</Link></li>
                <li><Link to="/integrations" className="text-base text-gray-300 hover:text-white">Integrations</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Company</h3>
              <ul className="mt-4 space-y-4">
                <li><Link to="/about" className="text-base text-gray-300 hover:text-white">About</Link></li>
                <li><Link to="/blog" className="text-base text-gray-300 hover:text-white">Blog</Link></li>
                <li><Link to="/careers" className="text-base text-gray-300 hover:text-white">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Resources</h3>
              <ul className="mt-4 space-y-4">
                <li><Link to="/documentation" className="text-base text-gray-300 hover:text-white">Documentation</Link></li>
                <li><Link to="/guides" className="text-base text-gray-300 hover:text-white">Guides</Link></li>
                <li><Link to="/api" className="text-base text-gray-300 hover:text-white">API</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Legal</h3>
              <ul className="mt-4 space-y-4">
                <li><Link to="/privacy" className="text-base text-gray-300 hover:text-white">Privacy</Link></li>
                <li><Link to="/terms" className="text-base text-gray-300 hover:text-white">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-700 pt-8">
            <p className="text-base text-gray-400 text-center">
              © 2024 HirePilot. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage; 