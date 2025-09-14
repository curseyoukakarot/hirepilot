import React, { useEffect, useState } from 'react';
import { getCandidateNotes, addCandidateNote, CandidateNote } from '../../lib/candidateNotes';

interface NotesDrawerProps {
  open: boolean;
  onClose: () => void;
  candidateId: string | null;
  candidateName?: string;
  stageTitle?: string;
}

export default function NotesDrawer({ open, onClose, candidateId, candidateName, stageTitle }: NotesDrawerProps) {
  const [notes, setNotes] = useState<CandidateNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [zapierEnabled, setZapierEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('zapier_notify_enabled') !== '0';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!open || !candidateId) return;
    (async () => {
      try {
        setLoading(true);
        const rows = await getCandidateNotes(candidateId);
        setNotes(rows);
      } catch {
        setNotes([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, candidateId]);

  const handleSubmit = async () => {
    const value = text.trim();
    if (!value || !candidateId) return;
    await addCandidateNote(candidateId, value);
    setText('');
    const rows = await getCandidateNotes(candidateId);
    setNotes(rows);
  };

  useEffect(() => {
    try {
      localStorage.setItem('zapier_notify_enabled', zapierEnabled ? '1' : '0');
    } catch {}
  }, [zapierEnabled]);

  return (
    <aside
      id="notes-drawer"
      className={`bg-white border-l w-[450px] flex-shrink-0 flex flex-col transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="p-6 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{candidateName || 'Candidate'}</h3>
          <p className="text-sm text-gray-500">{stageTitle || ''}</p>
        </div>
        <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
          <i className="fa-solid fa-xmark text-xl" />
        </button>
      </div>

      <div className="flex-grow overflow-y-auto p-6 space-y-4">
        <div id="notification-settings" className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-bell text-gray-400" />
            <span className="text-sm font-medium">Zapier notifications</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={zapierEnabled} onChange={(e)=>setZapierEnabled(e.target.checked)} />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading notes...</div>
        ) : (
          <div id="notes-thread" className="space-y-6">
            {notes.map((note) => (
              <div key={note.id} className="flex gap-3 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={note.author_avatar_url || ''} className="w-8 h-8 rounded-full mt-1 flex-shrink-0 bg-gray-100" alt={note.author_name || 'User'} />
                <div className="flex-grow">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{note.author_name || 'Unknown'}</span>
                      <span className="text-xs text-gray-400">{new Date(note.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.note_text}</p>
                  </div>
                </div>
              </div>
            ))}
            {notes.length === 0 && <div className="text-sm text-gray-400">No notes yet</div>}
          </div>
        )}

        <div className="mt-6 border-t border-gray-200 pt-4">
          <textarea
            id="note-input"
            placeholder="Write a note..."
            className="w-full p-3 rounded-lg bg-gray-50 text-sm mb-2 border"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end">
            <button onClick={handleSubmit} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
              Add Note
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}


