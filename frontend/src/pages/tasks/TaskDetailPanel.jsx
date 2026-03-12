import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import TaskActivityFeed from './TaskActivityFeed';

export default function TaskDetailPanel({
  task,
  activity,
  highlightedActivityId,
  statuses = [],
  assignees = [],
  onFieldUpdate,
  onMarkComplete,
  onAddComment,
  onDuplicate,
  onDelete,
  onCreateStatus,
  onConvertReminder,
  onClose,
  saving = false,
}) {
  const [draftTitle, setDraftTitle] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [customStatusLabel, setCustomStatusLabel] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
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
    <>
      {/* Mobile overlay backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 lg:hidden"
        onClick={() => onClose?.()}
      />

      {/* Panel: full-screen overlay on mobile, side panel on desktop */}
      <div className="fixed inset-0 z-50 lg:relative lg:z-30 lg:w-[400px] bg-white border-l border-gray-200 flex flex-col h-full shadow-drawer">
        {/* Mobile header with back button */}
        <div className="flex lg:hidden items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
          <button
            className="p-1.5 -ml-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            onClick={() => onClose?.()}
          >
            <i className="fa-solid fa-arrow-left" />
          </button>
          <span className="text-sm font-semibold text-gray-800 truncate">{task.title}</span>
        </div>

        {/* Desktop header */}
        <div className="hidden lg:flex px-6 py-4 border-b border-gray-200 items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded-md border border-gray-200 font-mono text-gray-600">{task.code}</span>
            <span>•</span>
            <span>{task.createdAt}</span>
          </div>
          <div className="relative flex items-center gap-2">
            <button className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-100 transition">
              <i className="fa-solid fa-link" />
            </button>
            <button
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-100 transition"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <i className="fa-solid fa-ellipsis" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-10 z-20 w-40 rounded-lg border border-gray-200 bg-white shadow-lg">
                <button
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                  onClick={() => {
                    setMenuOpen(false);
                    titleInputRef.current?.focus();
                  }}
                >
                  Edit
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setMenuOpen(false);
                    onDuplicate?.();
                  }}
                >
                  Duplicate
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50 rounded-b-lg"
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

        {/* Mobile compact header — code + actions */}
        <div className="flex lg:hidden items-center justify-between px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded-md border border-gray-200 font-mono text-gray-600">{task.code}</span>
            <span>•</span>
            <span>{task.createdAt}</span>
          </div>
          <div className="relative flex items-center gap-1">
            <button className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-100 transition" onClick={() => onDuplicate?.()}>
              <i className="fa-solid fa-copy text-xs" />
            </button>
            <button className="text-red-400 hover:text-red-600 p-1.5 rounded-md hover:bg-gray-100 transition" onClick={() => onDelete?.()}>
              <i className="fa-solid fa-trash text-xs" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <button className="mt-1.5 text-gray-300 hover:text-indigo-500 transition">
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
                className="text-lg md:text-xl font-bold text-gray-900 leading-snug bg-transparent border border-transparent focus:border-gray-300 rounded-lg px-1 -mx-1 w-full outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2 ml-8">
              <label className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-blue-100 transition border border-blue-200">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <select
                  value={task.statusKey || task.status}
                  onChange={(e) => onFieldUpdate?.({ status: e.target.value })}
                  className="bg-transparent outline-none text-xs font-semibold text-blue-700"
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
                className="flex items-center gap-1.5 bg-gray-50 text-gray-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-gray-100 transition border border-gray-300 border-dashed"
                onClick={() => setStatusModalOpen(true)}
              >
                <i className="fa-solid fa-plus text-[10px]" />
                Custom Status
              </button>
              <label className="flex items-center gap-1.5 bg-gray-50 text-gray-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-gray-100 transition border border-gray-300 border-dashed">
                <i className="fa-solid fa-calendar text-gray-400" />
                <input
                  type="date"
                  value={dueDateValue}
                  onChange={(e) => onFieldUpdate?.({ due_at: e.target.value ? `${e.target.value}T17:00:00.000Z` : null })}
                  className="bg-transparent outline-none text-xs font-medium text-gray-700"
                />
              </label>
              <label className="flex items-center gap-1.5 bg-gray-50 text-gray-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-gray-100 transition border border-gray-300 border-dashed">
                <span className={`w-2 h-2 rounded-full ${task.priorityTone === 'orange' ? 'bg-orange-400' : 'bg-red-500'}`} />
                <select
                  value={task.priorityKey || task.priority}
                  onChange={(e) => onFieldUpdate?.({ priority: e.target.value })}
                  className="bg-transparent outline-none text-xs font-medium text-gray-700"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Assignee</label>
                <select
                  value={task.assigneeId || ''}
                  onChange={(e) => onFieldUpdate?.({ assigned_to_user_id: e.target.value || null })}
                  className="mt-1 block w-full pl-2 pr-2 py-1 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-lg border bg-white text-gray-800"
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
                <a href="#" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
                  <i className={`${task.relatedTypeIcon} text-xs`} />
                  {task.relatedLabel}
                </a>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>
              </div>
            </div>
          </div>

          <TaskActivityFeed activity={activity} highlightedActivityId={highlightedActivityId} />
        </div>

        <div className="p-3 md:p-4 border-t border-gray-200 bg-gray-50">
          {statusModalOpen && (
            <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-medium text-gray-500 mb-2">Create custom status</div>
              <div className="flex items-center gap-2">
                <input
                  value={customStatusLabel}
                  onChange={(e) => setCustomStatusLabel(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-800"
                  placeholder="e.g. Waiting on Candidate"
                />
                <button
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-primary-600 text-white hover:bg-primary-700"
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
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
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
              className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Write a comment or type / for actions..."
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
              <button
                className="text-gray-400 hover:text-indigo-500 p-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={commentSubmitting}
                onClick={async () => {
                  const next = commentBody.trim();
                  if (!next) return;
                  setCommentSubmitting(true);
                  try {
                    await onAddComment?.(next);
                    setCommentBody('');
                  } catch (err) {
                    toast.error(err?.message || 'Failed to add comment');
                  } finally {
                    setCommentSubmitting(false);
                  }
                }}
              >
                <i className="fa-solid fa-paper-plane text-sm" />
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mt-3 gap-2">
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
                className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded transition"
                title="Add Attachment"
                onClick={() => attachmentInputRef.current?.click()}
              >
                <i className="fa-solid fa-paperclip text-sm" />
              </button>
              <button
                className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded transition"
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
                className="flex-1 sm:flex-none bg-white border border-gray-300 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 shadow-sm transition"
                onClick={() => onConvertReminder?.()}
              >
                Convert to Reminder
              </button>
              <button
                className="flex-1 sm:flex-none bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-primary-700 shadow-sm transition shadow-glow disabled:opacity-60"
                onClick={() => onMarkComplete?.()}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
