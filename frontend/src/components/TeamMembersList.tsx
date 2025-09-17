import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-red-100 text-red-800",
    team_admin: "bg-blue-100 text-blue-800",
    member: "bg-gray-100 text-gray-800",
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        colors[role] || "bg-gray-200 text-gray-700"
      }`}
    >
      {role.replace('_', ' ').toUpperCase()}
    </span>
  );
}

export default function TeamMembersList({ currentUserRole }: { currentUserRole: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setCurrentUser(user);

        // Get user's team_id
        const { data: userData } = await supabase
          .from('users')
          .select('team_id')
          .eq('id', user.id)
          .single();

        if (!userData?.team_id) {
          setMembers([]);
          return;
        }

        // Get all team members
        const { data, error } = await supabase
          .from('users')
          .select('id, email, role, first_name, last_name')
          .eq('team_id', userData.team_id)
          .order('role', { ascending: false });

        if (error) throw error;
        setMembers(data || []);
      } catch (error) {
        console.error('Error fetching team members:', error);
        toast.error('Failed to fetch team members');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  const updateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/team/updateRole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update role');
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
      );
      
      toast.success('Role updated successfully');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update role');
    }
  };

  if (loading) return <p className="text-gray-500">Loading team members...</p>;

  const canManage = ['admin', 'team_admin', 'super_admin'].includes(currentUserRole);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Team Members</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-900">Name</th>
              <th className="px-4 py-3 font-medium text-gray-900">Email</th>
              <th className="px-4 py-3 font-medium text-gray-900">Role</th>
              {canManage && <th className="px-4 py-3 font-medium text-gray-900">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                      <span className="text-sm font-medium text-gray-600">
                        {(member.first_name?.[0] || member.email[0]).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {member.first_name && member.last_name 
                        ? `${member.first_name} ${member.last_name}`
                        : member.email
                      }
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{member.email}</td>
                <td className="px-4 py-3">
                  <RoleBadge role={member.role} />
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <select
                      value={member.role}
                      onChange={(e) => updateRole(member.id, e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={member.id === currentUser?.id && member.role === 'admin'}
                    >
                      <option value="admin">Admin</option>
                      <option value="team_admin">Team Admin</option>
                      <option value="member">Member</option>
                    </select>
                    {member.id === currentUser?.id && member.role === 'admin' && (
                      <p className="text-xs text-gray-500 mt-1">Cannot demote yourself</p>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
