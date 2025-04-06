import React from 'react';
import { FaRocket, FaFolderOpen, FaAddressBook, FaCreditCard } from 'react-icons/fa6';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FaRocket className="text-blue-600 text-2xl" />
            <span className="text-xl font-semibold">HirePilot</span>
          </div>
          <nav className="flex items-center space-x-6">
            <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Dashboard</span>
            <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Campaigns</span>
            <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Leads</span>
            <img
              src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
              alt="User"
              className="w-8 h-8 rounded-full"
            />
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Campaigns */}
          <div className="bg-white rounded-xl p-8 text-center border border-gray-200 hover:border-blue-200 transition-all">
            <div className="mb-6">
              <FaFolderOpen className="text-6xl text-gray-300 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold mb-3">No Campaigns Yet</h3>
            <p className="text-gray-600 mb-6">
              You haven't created any campaigns yet. Start one now to begin your recruitment journey.
            </p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              + Create Campaign
            </button>
          </div>

          {/* Leads */}
          <div className="bg-white rounded-xl p-8 text-center border border-gray-200 hover:border-blue-200 transition-all">
            <div className="mb-6">
              <FaAddressBook className="text-6xl text-gray-300 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold mb-3">No Leads Found</h3>
            <p className="text-gray-600 mb-6">Connect with Clay or upload a CSV file to start building your lead database.</p>
            <div className="flex justify-center space-x-4">
              <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                Connect Clay
              </button>
              <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                Upload CSV
              </button>
            </div>
          </div>

          {/* Credits */}
          <div className="bg-white rounded-xl p-8 text-center border border-gray-200 hover:border-blue-200 transition-all">
            <div className="mb-6">
              <FaCreditCard className="text-6xl text-gray-300 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Low on Credits</h3>
            <p className="text-gray-600 mb-6">You're running low on credits. Top up now to continue sourcing candidates.</p>
            <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
              + Top Up Credits
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center text-sm text-gray-600">
          <span>© 2025 HirePilot. All rights reserved.</span>
          <div className="flex space-x-6">
            <span className="hover:text-gray-900 cursor-pointer">Terms</span>
            <span className="hover:text-gray-900 cursor-pointer">Privacy</span>
            <span className="hover:text-gray-900 cursor-pointer">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
