import React from 'react';

export default function LeadDrawer({ isOpen, onClose, lead, onSend }) {
  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
      <div className="bg-white w-80 p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Outreach to {lead.name}</h2>

        <textarea
          defaultValue={`Hi ${lead.name}, just following up on our previous conversation...`}
          className="w-full h-32 border p-2 mb-4"
        />

        <div className="flex justify-end space-x-2">
          <button
            onClick={() => {
              onSend();
              onClose();
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Send
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
