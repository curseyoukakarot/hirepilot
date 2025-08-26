import React from 'react';

export default function BlogNavbar() {
  return (
    <div className="sticky top-0 z-50 bg-gray-800 py-4 shadow-lg">
      <div className="max-w-6xl mx-auto px-6">
        <a href="/blog" className="text-gray-300 hover:text-white transition-colors flex items-center">
          <i className="fa-solid fa-arrow-left mr-2" />
          Back to Blog
        </a>
      </div>
    </div>
  );
}
