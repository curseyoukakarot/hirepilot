import React from 'react';
import { FaPlus, FaCrown, FaUser, FaEye, FaTrash } from 'react-icons/fa6';

export default function SettingsTeamMembers() {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Team Members</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your team members and their roles</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
          <FaPlus className="mr-2" /> Invite Member
        </button>
      </div>

      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Role Permissions</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-white rounded border">
            <div className="flex items-center space-x-2 mb-2">
              <FaCrown className="text-yellow-500" />
              <span className="font-medium">Admin</span>
            </div>
            <p className="text-gray-500">Full access to all features and settings</p>
          </div>
          <div className="p-3 bg-white rounded border">
            <div className="flex items-center space-x-2 mb-2">
              <FaUser className="text-blue-500" />
              <span className="font-medium">Member</span>
            </div>
            <p className="text-gray-500">Can manage campaigns and view analytics</p>
          </div>
          <div className="p-3 bg-white rounded border">
            <div className="flex items-center space-x-2 mb-2">
              <FaEye className="text-gray-500" />
              <span className="font-medium">Viewer</span>
            </div>
            <p className="text-gray-500">Can only view data and reports</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
          <div className="flex items-center space-x-4">
            <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="Team member" className="w-10 h-10 rounded-full" />
            <div>
              <h3 className="font-medium">John Cooper</h3>
              <p className="text-sm text-gray-500">john@company.com</p>
            </div>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">Owner</span>
          </div>
          <span className="text-sm text-gray-500">Joined Mar 1, 2025</span>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
          <div className="flex items-center space-x-4">
            <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg" alt="Team member" className="w-10 h-10 rounded-full" />
            <div>
              <h3 className="font-medium">Sarah Johnson</h3>
              <p className="text-sm text-gray-500">sarah@company.com</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">Joined Feb 15, 2025</span>
            <select className="px-3 py-2 border rounded-md text-sm">
              <option>Admin</option>
              <option>Member</option>
              <option>Viewer</option>
            </select>
            <button className="text-gray-400 hover:text-red-600">
              <FaTrash />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
          <div className="flex items-center space-x-4">
            <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" alt="Team member" className="w-10 h-10 rounded-full" />
            <div>
              <h3 className="font-medium">Michael Smith</h3>
              <p className="text-sm text-gray-500">michael@company.com</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">Joined Jan 20, 2025</span>
            <select className="px-3 py-2 border rounded-md text-sm">
              <option>Member</option>
              <option>Admin</option>
              <option>Viewer</option>
            </select>
            <button className="text-gray-400 hover:text-red-600">
              <FaTrash />
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Pending Invites</h3>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                <i className="fa-regular fa-envelope text-gray-400"></i>
              </div>
              <div>
                <h3 className="font-medium">alex@company.com</h3>
                <p className="text-sm text-gray-500">Invited as Member • Sent 2 days ago</p>
              </div>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700">Resend Invite</button>
          </div>
        </div>
      </div>
    </div>
  );
}
