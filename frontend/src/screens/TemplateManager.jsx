import React, { useEffect, useState } from 'react';
import {
  getTemplates,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
} from '../services/templatesService';
import toast from 'react-hot-toast';
import { StarIcon } from '@heroicons/react/solid';

function TemplateManager({ userId }) {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [userId]);

  const loadTemplates = async () => {
    try {
      const data = await getTemplates(userId);
      setTemplates(data);
    } catch {
      toast.error('Failed to load templates.');
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) {
      toast.error('Name and content are required!');
      return;
    }
    try {
      if (editingId) {
        await updateTemplate(userId, editingId, name, content);
        toast.success('Template updated!');
      } else {
        await saveTemplate(userId, name, content);
        toast.success('Template saved!');
      }
      await loadTemplates();
      resetForm();
    } catch {
      toast.error('Failed to save template.');
    }
  };

  const handleEdit = (template) => {
    setEditingId(template.id);
    setName(template.name);
    setContent(template.content);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await deleteTemplate(userId, id);
      toast.success('Template deleted!');
      await loadTemplates();
    } catch {
      toast.error('Failed to delete template.');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setContent('');
    setShowForm(false);
  };

  return (
    <div className="flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white p-4 border-r">
        <h3 className="text-lg font-bold mb-4">Recently Used</h3>
        <ul className="mb-6">
          <li className="text-sm mb-2 cursor-pointer text-blue-600">Follow-up Template</li>
          <li className="text-sm cursor-pointer text-blue-600">Initial Outreach</li>
        </ul>
        <h3 className="text-lg font-bold mb-4">My Favorites</h3>
        <ul className="mb-6">
          <li className="text-sm mb-2 cursor-pointer text-yellow-500">⭐ Cold Email Master</li>
          <li className="text-sm cursor-pointer text-yellow-500">⭐ Quick Response</li>
        </ul>
        <h3 className="text-lg font-bold mb-4">Personal Folders</h3>
        <ul className="mb-6">
          <li className="text-sm mb-2">📁 Cold Outreach (12)</li>
          <li className="text-sm mb-2">📁 Follow-ups (8)</li>
          <li className="text-sm">📁 Custom Templates (5)</li>
        </ul>
        <h3 className="text-lg font-bold mb-4">Tags</h3>
        <div className="flex flex-wrap gap-2">
          <span className="bg-purple-200 text-purple-800 px-2 py-1 rounded text-xs">#candidate</span>
          <span className="bg-green-200 text-green-800 px-2 py-1 rounded text-xs">#follow-up</span>
          <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs">#recruitment</span>
          <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs">#testing</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Templates</h1>
            <p className="text-sm text-gray-500">Data updated: May 4, 2025, 10:00 PM CDT ⓘ</p>
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Search templates..." className="border px-3 py-2 rounded" />
            <button className="border px-3 py-2 rounded">Filter</button>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded"
              onClick={() => setShowForm(true)}
            >
              + New Template
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white p-4 rounded shadow hover:shadow-md border">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">{t.name}</h3>
                <div className="flex gap-2">
                  <button className="text-yellow-500" onClick={() => handleEdit(t)}>✎</button>
                  <button className="text-red-500" onClick={() => handleDelete(t.id)}>🗑</button>
                </div>
              </div>
              <p className="text-sm mb-2">
                Subject: {t.subject || 'Opportunity at {company_name}'}
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">Cold Email</span>
                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">Recruitment</span>
              </div>
              <div className="text-xs text-gray-500">Sends: 234 | Opens: 45% | Replies: 12%</div>
            </div>
          ))}
        </div>
      </main>

      {/* Stylish Modal Drawer */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">{editingId ? 'Edit Template' : 'Create Template'}</h3>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">&times;</button>
            </div>

            <input
              className="border p-2 w-full mb-3 rounded"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template Name"
            />

            <div className="flex items-center mb-3">
              <select className="border p-2 rounded w-full mr-2">
                <option>Select Folder</option>
                <option>Cold Outreach</option>
                <option>Follow-ups</option>
                <option>Custom Templates</option>
              </select>
              <button className="text-blue-600 text-sm">EDIT</button>
            </div>

            <input
              className="border p-2 w-full mb-3 rounded"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Email Subject"
            />

            <div className="border p-2 rounded mb-3 flex items-center justify-between">
              <div className="flex gap-2">
                <select className="text-sm border rounded p-1">
                  <option>Default Font</option>
                </select>
                <select className="text-sm border rounded p-1">
                  <option>Default Size</option>
                </select>
                <button className="font-bold">B</button>
                <button className="italic">I</button>
                <button className="underline">U</button>
                <button>•</button>
              </div>
              <div className="flex gap-2">
                <button>🔗</button>
                <button>📷</button>
                <button>{`</>`}</button>
              </div>
            </div>

            <textarea
              className="border p-2 w-full mb-3 rounded"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your message here..."
            />

            <div className="flex gap-2 mb-3">
              <button className="bg-gray-100 px-3 py-1 rounded text-sm">📅 INSERT MEETING LINK</button>
              <button className="bg-gray-100 px-3 py-1 rounded text-sm">📎 INSERT ATTACHMENT</button>
              <button className="bg-gray-100 px-3 py-1 rounded text-sm">{`</>`} INSERT MERGE FIELD</button>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-500">Response Rate: 45%</div>
              <div className="w-32 h-2 bg-gray-200 rounded">
                <div className="h-full bg-green-500 rounded" style={{ width: '45%' }}></div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button className="bg-gray-500 text-white px-4 py-2 rounded" onClick={resetForm}>
                Cancel
              </button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleSave}>
                {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateManager;
