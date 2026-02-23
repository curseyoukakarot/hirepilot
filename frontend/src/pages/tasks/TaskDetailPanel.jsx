import React, { useEffect, useMemo, useRef, useState } from 'react';
import TaskActivityFeed from './TaskActivityFeed';

export default function TaskDetailPanel({
  task,
  activity,
  statuses = [],
  assignees = [],
  onFieldUpdate,
  onMarkComplete,
  onAddComment,
  onDuplicate,
  onDelete,
  onCreateStatus,
  onConvertReminder,
  saving = false,
}) {
  const [draftTitle, setDraftTitle] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [customStatusLabel, setCustomStatusLabel] = useState('');
  const titleInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  const dueDateValue = useMemo(() => {
    if (!task?.dueAt) return '';
    const dt = new Date(task.dueAt);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toISOString().slice(0, 10);
  }, [task?.dueAt]);

  useEffect(() => {
    setDraftTitle('');
    setCommentBody('');
    setMenuOpen(false);
    setStatusModalOpen(false);
    setCustomStatusLabel('');
  }, [task?.id]);

  if (!task) {
    return null;
  }

  return (
    <div className="w-[400px] bg-dark-300 border-l border-gray-800 flex-col h-full shadow-drawer z-30 lg:relative lg:flex hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="bg-dark-200 px-2 py-1 rounded border border-gray-700">{task.code}</span>
          <span>•</span>
          <span>{task.createdAt}</span>
        </div>
        <div className="relative flex items-center gap-2">
          <button className="text-gray-500 hover:text-gray-300 p-1.5 rounded-md hover:bg-dark-200 transition">
            <i className="fa-solid fa-link" />
          </button>
          <button
            className="text-gray-500 hover:text-gray-300 p-1.5 rounded-md hover:bg-dark-200 transition"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <i className="fa-solid fa-ellipsis" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-40 rounded-md border border-gray-700 bg-dark-200 shadow-lg">
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-dark-100"
                onClick={() => {
                  setMenuOpen(false);
                  titleInputRef.current?.focus();
                }}
              >
                Edit
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-dark-100"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate?.();
                }}
              >
                Duplicate
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-dark-100"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete?.();
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-4">
            <button className="mt-1.5 text-gray-600 hover:text-primary-400 transition">
              <i className="fa-regular fa-circle text-xl" />
            </button>
            <input
              ref={titleInputRef}
              value={draftTitle || task.title}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={() => {
                const next = (draftTitle || task.title).trim();
                setDraftTitle('');
                if (!next || next === task.title) return;
                onFieldUpdate?.({ title: next });
              }}
              className="text-xl font-bold text-white leading-snug bg-transparent border border-transparent focus:border-gray-700 rounded px-1 -mx-1 w-full outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2 ml-8">
            <label className="flex items-center gap-1.5 bg-blue-600/20 text-blue-400 px-3 py-1 rounded-md text-xs font-semibold hover:bg-blue-600/30 transition border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <select
                value={task.statusKey || task.status}
                onChange={(e) => onFieldUpdate?.({ status: e.target.value })}
                className="bg-transparent outline-none text-xs font-semibold"
              >
                {statuses.length
                  ? statuses.map((status) => (
                      <option key={status.key} value={status.key}>
                        {status.label}
                      </option>
                    ))
                  : (
                      <option value={task.status}>{task.status}</option>
                    )}
              </select>
              <i className="fa-solid fa-chevron-down text-[10px] ml-1 opacity-50" />
            </label>
            <button
              className="flex items-center gap-1.5 bg-dark-200 text-gray-300 px-3 py-1 rounded-md text-xs font-medium hover:bg-dark-100 transition border border-gray-700 border-dashed"
              onClick={() => setStatusModalOpen(true)}
            >
              <i className="fa-solid fa-plus text-[10px]" />
              Custom Status
            </button>
            <label className="flex items-center gap-1.5 bg-dark-200 text-gray-300 px-3 py-1 rounded-md text-xs font-medium hover:bg-dark-100 transition border border-gray-700 border-dashed">
              <i className="fa-solid fa-calendar text-gray-500" />
              <input
                type="date"
                value={dueDateValue}
                onChange={(e) => onFieldUpdate?.({ due_at: e.target.value ? `${e.target.value}T17:00:00.000Z` : null })}
                className="bg-transparent outline-none text-xs font-medium"
              />
            </label>
            <label className="flex items-center gap-1.5 bg-dark-200 text-gray-300 px-3 py-1 rounded-md text-xs font-medium hover:bg-dark-100 transition border border-gray-700 border-dashed">
              <span className={`w-2 h-2 rounded-full ${task.priorityTone === 'orange' ? 'bg-orange-400' : 'bg-red-500'}`} />
              <select
                value={task.priorityKey || task.priority}
                onChange={(e) => onFieldUpdate?.({ priority: e.target.value })}
                className="bg-transparent outline-none text-xs font-medium"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
        </div>

        <div className="bg-dark-200 rounded-lg p-4 mb-6 border border-gray-800">
          <div className="grid grid-cols-2 gap-y-4 gap-x-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Assignee</label>
              <select
                value={task.assigneeId || ''}
                onChange={(e) => onFieldUpdate?.({ assigned_to_user_id: e.target.value || null })}
                className="mt-1 block w-full pl-2 pr-2 py-1 text-sm border-gray-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md border bg-dark-300 text-gray-200"
              >
                <option value="">Unassigned</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Related To</label>
              <a href="#" className="flex items-center gap-1.5 text-sm text-primary-400 hover:underline">
                <i className={`${task.relatedTypeIcon} text-xs`} />
                {task.relatedLabel}
              </a>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <p className="text-sm text-gray-400 leading-relaxed">{task.description}</p>
            </div>
          </div>
        </div>

        <TaskActivityFeed activity={activity} />
      </div>

      <div className="p-4 border-t border-gray-800 bg-dark-200">
        {statusModalOpen && (
          <div className="mb-3 rounded-md border border-gray-700 bg-dark-300 p-3">
            <div className="text-xs font-medium text-gray-400 mb-2">Create custom status</div>
            <div className="flex items-center gap-2">
              <input
                value={customStatusLabel}
                onChange={(e) => setCustomStatusLabel(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-700 rounded bg-dark-200 text-sm text-gray-200"
                placeholder="e.g. Waiting on Candidate"
              />
              <button
                className="px-2.5 py-1.5 text-xs rounded bg-primary-600 text-white hover:bg-primary-700"
                onClick={async () => {
                  const label = customStatusLabel.trim();
                  if (!label) return;
                  await onCreateStatus?.(label);
                  setCustomStatusLabel('');
                  setStatusModalOpen(false);
                }}
              >
                Save
              </button>
              <button
                className="px-2.5 py-1.5 text-xs rounded border border-gray-700 text-gray-300 hover:bg-dark-100"
                onClick={() => {
                  setCustomStatusLabel('');
                  setStatusModalOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="relative">
          <input
            type="text"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 border border-gray-700 rounded-md leading-5 bg-dark-300 placeholder-gray-500 text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder="Write a comment or type / for actions..."
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <button
              className="text-gray-500 hover:text-primary-400 p-1 transition"
              onClick={() => {
                const next = commentBody.trim();
                if (!next) return;
                onAddComment?.(next);
                setCommentBody('');
              }}
            >
              <i className="fa-solid fa-paper-plane text-sm" />
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-2">
            <input
              ref={attachmentInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const fileName = e.target.files?.[0]?.name;
                if (!fileName) return;
                setCommentBody((prev) => `${prev}${prev ? ' ' : ''}[Attachment: ${fileName}]`);
                e.target.value = '';
              }}
            />
            <button
              className="p-1.5 text-gray-500 hover:bg-dark-300 hover:text-gray-300 hover:shadow-sm rounded transition"
              title="Add Attachment"
              onClick={() => attachmentInputRef.current?.click()}
            >
              <i className="fa-solid fa-paperclip text-sm" />
            </button>
            <button
              className="p-1.5 text-gray-500 hover:bg-dark-300 hover:text-gray-300 hover:shadow-sm rounded transition"
              title="Mention"
              onClick={() => {
                const mention = window.prompt('Mention teammate (name or @handle)');
                if (!mention) return;
                const normalized = mention.startsWith('@') ? mention : `@${mention}`;
                setCommentBody((prev) => `${prev}${prev ? ' ' : ''}${normalized}`);
              }}
            >
              <i className="fa-solid fa-at text-sm" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              className="bg-dark-300 border border-gray-700 text-gray-300 text-xs font-medium px-3 py-1.5 rounded hover:bg-dark-200 shadow-sm transition"
              onClick={() => onConvertReminder?.()}
            >
              Convert to Reminder
            </button>
            <button
              className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700 shadow-sm transition shadow-glow disabled:opacity-60"
              onClick={() => onMarkComplete?.()}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Mark Complete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
