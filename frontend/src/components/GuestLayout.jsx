import React from 'react';
import { Link } from 'react-router-dom';

export default function GuestLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold">HirePilot</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/settings" className="text-gray-600 hover:text-gray-900">Settings</Link>
            <a href="/signout" className="text-gray-600 hover:text-gray-900">Sign Out</a>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
