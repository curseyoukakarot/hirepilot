/**
 * Reassign Proxy Modal
 * Interface for reassigning proxy to different users
 */

import React, { useState, useEffect } from 'react';
import { X, Users, Search, User, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';

const ReassignProxyModal = ({ proxy, onClose, onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [reassigning, setReassigning] = useState(false);
  const [reason, setReason] = useState('admin_manual');

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    // Filter users based on search term
    const filtered = users.filter(user =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [users, searchTerm]);

  /**
   * Load available users
   */
  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // For now, we'll use a simple approach to get users
      // In a real app, you'd have a proper user management API
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/users', { // This endpoint would need to be created
        headers: {
          'Authorization': `Bearer ${data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setUsers(result.data || []);
      } else {
        // Fallback: create mock users for demo
        setUsers([
          { id: '1', email: 'john@example.com', full_name: 'John Doe' },
          { id: '2', email: 'jane@example.com', full_name: 'Jane Smith' },
          { id: '3', email: 'bob@example.com', full_name: 'Bob Johnson' }
        ]);
      }
      
    } catch (error) {
      console.error('Error loading users:', error);
      // Use mock data on error
      setUsers([
        { id: '1', email: 'john@example.com', full_name: 'John Doe' },
        { id: '2', email: 'jane@example.com', full_name: 'Jane Smith' },
        { id: '3', email: 'bob@example.com', full_name: 'Bob Johnson' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle proxy reassignment
   */
  const handleReassign = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }
    
    try {
      setReassigning(true);
      
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/proxies/${proxy.id}/reassign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: selectedUser.id,
          reason: reason
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to reassign proxy');
      }
      
      const result = await response.json();
      toast.success(result.message || 'Proxy reassigned successfully');
      onSuccess?.();
      
    } catch (error) {
      console.error('Error reassigning proxy:', error);
      toast.error(error.message || 'Failed to reassign proxy');
    } finally {
      setReassigning(false);
    }
  };

  /**
   * User selection component
   */
  const UserCard = ({ user, isSelected, onClick }) => (
    <div
      onClick={() => onClick(user)}
      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
        isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center">
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
          <User className="w-4 h-4 text-gray-600" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">
            {user.full_name || 'Unknown Name'}
          </div>
          <div className="text-sm text-gray-500">{user.email}</div>
        </div>
        {isSelected && (
          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reassign Proxy</h2>
            <p className="text-sm text-gray-600">{proxy?.endpoint}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Current Assignment */}
        {proxy?.assigned_users && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Currently Assigned To:</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-sm text-gray-900">{proxy.assigned_users}</div>
            </div>
          </div>
        )}

        {/* User Search */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select New User
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by email or name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* User List */}
        <div className="mb-6">
          <div className="max-h-60 overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center py-4 text-gray-500">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                {searchTerm ? 'No users found matching your search' : 'No users available'}
              </div>
            ) : (
              filteredUsers.map(user => (
                <UserCard
                  key={user.id}
                  user={user}
                  isSelected={selectedUser?.id === user.id}
                  onClick={setSelectedUser}
                />
              ))
            )}
          </div>
        </div>

        {/* Assignment Preview */}
        {selectedUser && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Assignment Preview:</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">From:</div>
                    <div className="text-gray-600">
                      {proxy?.assigned_users || 'Unassigned'}
                    </div>
                  </div>
                </div>
                
                <ArrowRight className="w-5 h-5 text-blue-600 mx-4" />
                
                <div className="flex items-center">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">To:</div>
                    <div className="text-blue-600 font-medium">
                      {selectedUser.email}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reassignment Reason */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Reassignment
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="admin_manual">Manual Admin Assignment</option>
            <option value="performance_issue">Performance Issue</option>
            <option value="user_request">User Request</option>
            <option value="load_balancing">Load Balancing</option>
            <option value="maintenance">Maintenance</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Warning */}
        <div className="mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <Users className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <div className="font-medium mb-1">Important:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>This will immediately reassign the proxy to the selected user</li>
                  <li>Any ongoing jobs using this proxy may be affected</li>
                  <li>The change will be logged for audit purposes</li>
                  <li>The user will be notified of the new proxy assignment</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReassign}
            disabled={!selectedUser || reassigning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center disabled:opacity-50"
          >
            {reassigning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Reassigning...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Reassign Proxy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReassignProxyModal; 