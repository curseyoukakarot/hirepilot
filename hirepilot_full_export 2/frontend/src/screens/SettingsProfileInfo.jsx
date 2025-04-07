import React from 'react';

export default function SettingsProfileInfo() {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold mb-6">Profile Information</h2>

      <div className="space-y-6">
        <div className="flex items-center space-x-6">
          <img
            src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
            alt="Profile"
            className="w-20 h-20 rounded-full"
          />
          <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Change Photo
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-md"
              defaultValue="John Cooper"
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              className="w-full px-4 py-2 border rounded-md"
              defaultValue="john@company.com"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-md"
              defaultValue="Tech Solutions Inc."
            />
          </div>

          <div className="col-span-2 border-t pt-6 mt-6">
            <h3 className="text-lg font-medium mb-4">Password</h3>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
              Reset Password
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
