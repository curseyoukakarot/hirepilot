import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface UserData {
  user: {
    id: string;
    email: string;
    role: string;
    credits_available: number;
    credits_used: number;
    team_id: string | null;
    created_at: string;
    first_name: string | null;
    last_name: string | null;
    onboarding_complete: boolean;
  };
  team: {
    id: string;
    name: string;
    created_at: string;
  } | null;
  candidates: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    status: string;
    created_at: string;
  }>;
  leads: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    company_name: string;
    created_at: string;
  }>;
  campaigns: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
  }>;
  subscription: {
    plan_tier: string;
    seat_count: number;
    included_seats: number;
    status: string;
    created_at: string;
  } | null;
}

interface UserDetailDrawerProps {
  userId: string | null;
  onClose: () => void;
}

export default function UserDetailDrawer({ userId, onClose }: UserDetailDrawerProps) {
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchUserData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/viewUser?userId=${userId}`);
        
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to fetch user data');
        }

        const userData = await res.json();
        setData(userData);
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  if (!userId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-end z-50">
      <div className="bg-white w-96 h-full shadow-lg overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">User Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-500">Loading...</span>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* User Basic Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Name:</span>
                    <p className="text-gray-900">
                      {data.user.first_name && data.user.last_name 
                        ? `${data.user.first_name} ${data.user.last_name}`
                        : 'Not provided'
                      }
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Email:</span>
                    <p className="text-gray-900">{data.user.email}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Role:</span>
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      data.user.role === 'super_admin' ? 'bg-red-100 text-red-800' :
                      data.user.role === 'admin' ? 'bg-red-100 text-red-800' :
                      data.user.role === 'team_admin' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {data.user.role.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Member Since:</span>
                    <p className="text-gray-900">
                      {new Date(data.user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Onboarding:</span>
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      data.user.onboarding_complete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {data.user.onboarding_complete ? 'Complete' : 'Incomplete'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Credits */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Credits</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Available:</span>
                    <span className="text-lg font-semibold text-green-600">{data.user.credits_available}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium text-gray-500">Used:</span>
                    <span className="text-lg font-semibold text-gray-900">{data.user.credits_used}</span>
                  </div>
                </div>
              </div>

              {/* Team Info */}
              {data.team && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Team</h3>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="font-medium text-blue-900">{data.team.name}</p>
                    <p className="text-sm text-blue-700">Team ID: {data.team.id}</p>
                  </div>
                </div>
              )}

              {/* Subscription */}
              {data.subscription && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Subscription</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Plan:</span>
                      <span className="font-medium text-gray-900 capitalize">{data.subscription.plan_tier}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm font-medium text-gray-500">Seats:</span>
                      <span className="text-gray-900">{data.subscription.seat_count}/{data.subscription.included_seats}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm font-medium text-gray-500">Status:</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        data.subscription.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {data.subscription.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Candidates */}
              {data.candidates.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Candidates</h3>
                  <div className="space-y-2">
                    {data.candidates.slice(0, 5).map((candidate) => (
                      <div key={candidate.id} className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium text-gray-900">
                          {candidate.first_name} {candidate.last_name}
                        </p>
                        <p className="text-sm text-gray-600">{candidate.email}</p>
                        <div className="flex justify-between items-center mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            candidate.status === 'hired' ? 'bg-green-100 text-green-800' :
                            candidate.status === 'interviewed' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {candidate.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(candidate.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Leads */}
              {data.leads.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Leads</h3>
                  <div className="space-y-2">
                    {data.leads.slice(0, 5).map((lead) => (
                      <div key={lead.id} className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium text-gray-900">
                          {lead.first_name} {lead.last_name}
                        </p>
                        <p className="text-sm text-gray-600">{lead.email}</p>
                        <p className="text-sm text-gray-500">{lead.company_name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Campaigns */}
              {data.campaigns.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Campaigns</h3>
                  <div className="space-y-2">
                    {data.campaigns.map((campaign) => (
                      <div key={campaign.id} className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium text-gray-900">{campaign.title}</p>
                        <div className="flex justify-between items-center mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                            campaign.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {campaign.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(campaign.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Failed to load user data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
