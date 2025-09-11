import React, { useState } from 'react';
import { canPlan } from '../../lib/permissions';

interface Props {
  onClose: () => void;
}

export default function InviteCollaboratorsModal({ onClose }: Props) {
  const [emails, setEmails] = useState('');
  const plan = 'free';
  const currentCollabs = 2;
  const limitReached = !canPlan('invite', plan as any, { collabCount: currentCollabs });

  const invite = () => {
    if (limitReached) return;
    console.log('invite', emails.split(','));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Invite Collaborators</h2>
        {limitReached && (
          <p className="mb-4 text-sm text-red-600">
            Invite limit reached for your plan.
          </p>
        )}
        <textarea
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="Enter emails separated by commas"
          className="w-full border rounded p-2 mb-4"
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={invite}
            disabled={limitReached}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}
