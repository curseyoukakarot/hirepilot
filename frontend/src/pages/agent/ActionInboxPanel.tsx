import React from 'react';
import ActionInbox from '../../screens/ActionInbox';

export default function ActionInboxPanel(){
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4">Action Inbox</h2>
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <ActionInbox panelMode />
      </div>
    </div>
  );
}


