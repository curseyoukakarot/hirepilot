import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PublicNavbar from '../../components/PublicNavbar';
import PremiumFeatureLockModal from '../../components/billing/PremiumFeatureLockModal';
import { canPlan, canRole, Plan, CollabRole } from '../../lib/permissions';

const tabs = ['overview', 'team', 'candidates', 'activity', 'pipeline'] as const;
type Tab = typeof tabs[number];

const featureLabels: Record<string, string> = {
  invite: 'Inviting collaborators',
  comment: 'Commenting',
  pipeline: 'Pipeline',
  activity: 'Activity',
};

export default function JobRequisitionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState('Job Title');
  const [status] = useState('draft');
  const [dept] = useState('Engineering');
  const [location] = useState('Remote');
  const [level] = useState('Senior');
  const [assignees] = useState([
    { id: '1', name: 'Alice', avatar: 'https://ui-avatars.com/api/?name=Alice' },
    { id: '2', name: 'Bob', avatar: 'https://ui-avatars.com/api/?name=Bob' },
  ]);

  const plan: Plan = 'free';
  const role: CollabRole = 'viewer';
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const collabCount = assignees.length;

  const editable = canRole('edit', role);

  const handleInvite = () => {
    if (!canPlan('invite', plan, { collabCount })) {
      setLockedFeature(featureLabels.invite);
      return;
    }
    // stub invite action
  };

  const handleComment = () => {
    if (!canPlan('comment', plan)) {
      setLockedFeature(featureLabels.comment);
      return;
    }
    // stub comment action
  };

  const handleTab = (tab: Tab) => {
    if (tab === 'pipeline' && !canPlan('pipeline', plan)) {
      setLockedFeature(featureLabels.pipeline);
      return;
    }
    if (tab === 'activity' && !canPlan('activity', plan)) {
      setLockedFeature(featureLabels.activity);
      return;
    }
    setActiveTab(tab);
    if (tab === 'pipeline') navigate(`/job/${id}/pipeline`);
  };

  return (
    <div>
      <PublicNavbar />
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex items-start justify-between">
          <div>
            {editable ? (
              <input
                className="text-2xl font-semibold border-b focus:outline-none"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            ) : (
              <h1 className="text-2xl font-semibold">{title}</h1>
            )}
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-100 rounded text-sm capitalize">{status}</span>
              {[dept, location, level].map((tag) => (
                <span key={tag} className="px-2 py-1 bg-gray-100 rounded text-sm">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-2 flex -space-x-2">
              {assignees.map((a) => (
                <img
                  key={a.id}
                  src={a.avatar}
                  alt={a.name}
                  className="w-8 h-8 rounded-full border-2 border-white"
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={handleInvite}>
              Share
            </button>
            <button className="btn" onClick={() => {}}>
              REX
            </button>
            <button className="btn" onClick={() => {}} disabled={!editable}>
              Edit
            </button>
            <button className="btn" onClick={() => {}}>
              Archive
            </button>
            <button className="btn" onClick={() => {}}>
              Clone
            </button>
          </div>
        </div>
        <div className="mt-6 border-b">
          <nav className="flex gap-4">
            {tabs.map((t) => (
              <button
                key={t}
                className={`pb-2 ${activeTab === t ? 'border-b-2 border-blue-500' : ''}`}
                onClick={() => handleTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-4">
          {activeTab === 'overview' && <div>Overview content</div>}
          {activeTab === 'team' && (
            <div>
              Team content
              <button className="ml-2 underline" onClick={handleInvite}>
                Invite
              </button>
            </div>
          )}
          {activeTab === 'candidates' && (
            <div>
              Candidates content
              <button className="ml-2 underline" onClick={handleComment}>
                Comment
              </button>
            </div>
          )}
          {activeTab === 'activity' && <div>Activity feed</div>}
          {activeTab === 'pipeline' && <div>Pipeline content</div>}
        </div>
      </div>
      {lockedFeature && (
        <PremiumFeatureLockModal
          featureName={lockedFeature}
          onClose={() => setLockedFeature(null)}
        />
      )}
    </div>
  );
}
