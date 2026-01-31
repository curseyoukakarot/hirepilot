import React from 'react';
import { useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import type { KanbanBoard, KanbanBoardSummary, KanbanTemplate } from '../../shared/kanbanTypes';

const DEFAULT_AVATAR =
  'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg';

function formatUpdatedAt(value?: string | null) {
  if (!value) return 'Updated just now';
  const updated = new Date(value).getTime();
  const diff = Math.max(0, Date.now() - updated);
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}

function resolveTemplateAccent(template: KanbanTemplate | null) {
  if (!template) return { wrapper: 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30', icon: 'bg-indigo-600', button: 'bg-indigo-600 hover:bg-indigo-700', iconName: 'fa-users' };
  if (template.id === 'client_acquisition') {
    return { wrapper: 'bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30', icon: 'bg-purple-600', button: 'bg-purple-600 hover:bg-purple-700', iconName: 'fa-handshake' };
  }
  if (template.id === 'delivery_execution') {
    return { wrapper: 'bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30', icon: 'bg-green-600', button: 'bg-green-600 hover:bg-green-700', iconName: 'fa-rocket' };
  }
  return { wrapper: 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30', icon: 'bg-indigo-600', button: 'bg-indigo-600 hover:bg-indigo-700', iconName: 'fa-users' };
}

function resolveBoardAvatar(board: KanbanBoardSummary): string {
  const members = board.memberPreview || [];
  const owner = members.find((member) => member.role === 'owner' && member.user?.avatarUrl);
  if (owner?.user?.avatarUrl) return owner.user.avatarUrl;
  const collaborator = members.find((member) => member.user?.avatarUrl);
  return collaborator?.user?.avatarUrl || DEFAULT_AVATAR;
}

export default function KanbanBoardsPage() {
  const navigate = useNavigate();
  const [boards, setBoards] = React.useState<KanbanBoardSummary[]>([]);
  const [templates, setTemplates] = React.useState<KanbanTemplate[]>([]);
  const [search, setSearch] = React.useState('');
  const [boardName, setBoardName] = React.useState('');
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null);
  const [actionMenuBoardId, setActionMenuBoardId] = React.useState<string | null>(null);
  const [showCreateBoardModal, setShowCreateBoardModal] = React.useState(false);
  const [showBoardCanvas, setShowBoardCanvas] = React.useState(false);
  const [showCardDrawer, setShowCardDrawer] = React.useState(false);
  const [showLinkEntityModal, setShowLinkEntityModal] = React.useState(false);
  const [showInviteModal, setShowInviteModal] = React.useState(false);

  const openCreateBoardModal = () => setShowCreateBoardModal(true);
  const closeCreateBoardModal = () => setShowCreateBoardModal(false);
  const createBoard = async () => {
    try {
      if (selectedTemplateId) {
        await createFromTemplate(selectedTemplateId);
        setSelectedTemplateId(null);
        closeCreateBoardModal();
        return;
      }
      const name = boardName.trim() || 'Untitled Board';
      const payload: { name: string; boardType?: string | null } = { name };
      const created = await apiPost('/api/boards', payload);
      const board = (created as any)?.board as KanbanBoard | undefined;
      if (board?.id) {
        setBoardName('');
        closeCreateBoardModal();
        await refreshBoards();
        navigate(`/kanban/${board.id}`);
        return;
      }
      closeCreateBoardModal();
    } catch (err) {
      console.error(err);
    }
  };
  const createFromTemplate = async (templateId: string) => {
    try {
      const created = await apiPost('/api/boards/from-template', {
        templateId,
        boardName: boardName.trim() || undefined,
      });
      const board = (created as any)?.board as KanbanBoard | undefined;
      if (board?.id) {
        await refreshBoards();
        navigate(`/kanban/${board.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };
  const openBoard = (boardId: string) => navigate(`/kanban/${boardId}`);
  const closeBoard = () => setShowBoardCanvas(false);
  const openCardDrawer = () => setShowCardDrawer(true);
  const closeCardDrawer = () => setShowCardDrawer(false);
  const openLinkEntityModal = () => setShowLinkEntityModal(true);
  const closeLinkEntityModal = () => setShowLinkEntityModal(false);
  const openInviteModal = () => setShowInviteModal(true);
  const closeInviteModal = () => setShowInviteModal(false);
  const openFilterPopover = () => alert('Filter popover opening...');

  const closeActionMenu = () => setActionMenuBoardId(null);

  React.useEffect(() => {
    if (!actionMenuBoardId) return;
    const handleClick = () => setActionMenuBoardId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [actionMenuBoardId]);

  const refreshBoards = React.useCallback(async () => {
    const [boardsResp, templatesResp] = await Promise.all([
      apiGet('/api/boards'),
      apiGet('/api/boards/templates'),
    ]);
    setBoards((boardsResp as any)?.boards || []);
    setTemplates((templatesResp as any)?.templates || []);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshBoards();
      } catch (err) {
        console.error(err);
      } finally {
        if (!mounted) return;
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshBoards]);

  const filteredBoards = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return boards;
    return boards.filter((b) => b.name.toLowerCase().includes(query));
  }, [boards, search]);

  const recentBoards = filteredBoards.slice(0, 3);
  const allBoards = filteredBoards;
  const primaryTemplates = templates.slice(0, 3);

  const handleDeleteBoard = async (boardId: string) => {
    if (!window.confirm('Delete this board?')) return;
    try {
      await apiDelete(`/api/boards/${boardId}`);
      await refreshBoards();
    } catch (err) {
      console.error(err);
    } finally {
      closeActionMenu();
    }
  };

  const handleDuplicateBoard = async (board: KanbanBoardSummary) => {
    try {
      await apiPost('/api/boards', {
        name: `${board.name} Copy`,
        boardType: board.boardType ?? null,
      });
      await refreshBoards();
    } catch (err) {
      console.error(err);
    } finally {
      closeActionMenu();
    }
  };

  const handleEditBoard = async (board: KanbanBoardSummary) => {
    const nextName = window.prompt('Rename board', board.name);
    if (!nextName || nextName.trim() === board.name) {
      closeActionMenu();
      return;
    }
    try {
      await apiPatch(`/api/boards/${board.id}`, { name: nextName.trim() });
      await refreshBoards();
    } catch (err) {
      console.error(err);
    } finally {
      closeActionMenu();
    }
  };

  return (
    <div className="bg-[#0a0a0b]">
      <style>{`
        :root {
            --bg: #0a0a0b;
            --panel: #141416;
            --panel-2: #1c1c1f;
            --border: #2a2a2e;
            --text: #ffffff;
            --muted: #a1a1aa;
            --accent: #6366f1;
            --accent-hover: #4f46e5;
        }
        
        * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        }
        
        ::-webkit-scrollbar { 
            display: none;
        }
        
        body {
            background: var(--bg);
            color: var(--text);
            overflow-x: hidden;
        }
        
        .board-card {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .board-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 40px rgba(99, 102, 241, 0.15);
        }
        
        .kanban-card {
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .kanban-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        }
        
        .kanban-card.dragging {
            transform: rotate(2deg) scale(1.02);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
        }
        
        .list-column {
            min-width: 320px;
            max-width: 320px;
        }
        
        .drawer-overlay {
            backdrop-filter: blur(4px);
        }
        
        .modal-content {
            animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .drawer-slide {
            animation: drawerSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        @keyframes drawerSlideIn {
            from {
                transform: translateX(100%);
            }
            to {
                transform: translateX(0);
            }
        }
        
        .label-chip {
            transition: all 0.2s ease;
        }
        
        .label-chip:hover {
            transform: scale(1.05);
        }
        
        .presence-avatar {
            border: 2px solid var(--panel);
            margin-left: -8px;
        }
        
        .presence-avatar:first-child {
            margin-left: 0;
        }
        
        .live-dot {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.5;
            }
        }
        
        .card-cover {
            height: 8px;
            border-radius: 14px 14px 0 0;
        }
        
        .quick-action-btn {
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        
        .kanban-card:hover .quick-action-btn {
            opacity: 1;
        }
        
        .gradient-bg-1 {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        .gradient-bg-2 {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        
        .gradient-bg-3 {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
      `}</style>

      <div id="app-container" className="flex h-screen">
        <main id="main-content" className="flex-1 flex flex-col overflow-hidden">
          <header id="boards-header" className="bg-[#141416] border-b border-[#2a2a2e] px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div>
                  <h1 className="text-3xl font-bold text-white">Boards</h1>
                  <p className="text-sm text-[#a1a1aa] mt-1">Manage your recruiting and sales workflows</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search boards..."
                    className="w-64 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-[#a1a1aa] focus:outline-none focus:border-indigo-500 transition-all"
                  />
                  <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] text-sm"></i>
                </div>
                <button onClick={openCreateBoardModal} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center space-x-2 transition-all">
                  <i className="fa-solid fa-plus"></i>
                  <span>Create Board</span>
                </button>
              </div>
            </div>
          </header>

          <div id="boards-hub-content" className="flex-1 overflow-y-auto p-8">
            <section id="recent-boards" className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <i className="fa-solid fa-clock text-indigo-500"></i>
                  <span>Recent Boards</span>
                </h2>
                <button className="text-sm text-[#a1a1aa] hover:text-white transition-all">View All</button>
              </div>

              <div className="grid grid-cols-3 gap-6">
                {recentBoards.map((board) => {
                  const members = board.memberPreview || [];
                  const visibleMembers = members.slice(0, 3);
                  const extraMembers = members.length - visibleMembers.length;
                  return (
                    <div
                      key={board.id}
                      id={`board-card-${board.id}`}
                      className="board-card bg-[#141416] border border-[#2a2a2e] rounded-2xl p-6 cursor-pointer"
                      onClick={() => openBoard(board.id)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-2">{board.name}</h3>
                          <div className="flex items-center space-x-2 mb-3">
                            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold">
                              {board.boardType || 'Board'}
                            </span>
                            <span className="text-xs text-[#a1a1aa]">{formatUpdatedAt(board.updatedAt)}</span>
                          </div>
                        </div>
                        <div className="relative">
                          <button
                            className="text-[#a1a1aa] hover:text-white transition-all"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActionMenuBoardId(actionMenuBoardId === board.id ? null : board.id);
                            }}
                          >
                            <i className="fa-solid fa-ellipsis-vertical"></i>
                          </button>
                          {actionMenuBoardId === board.id ? (
                            <div
                              className="absolute right-0 mt-2 w-40 bg-[#141416] border border-[#2a2a2e] rounded-xl shadow-xl z-50"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#1c1c1f] rounded-t-xl"
                                onClick={() => handleEditBoard(board)}
                              >
                                Edit
                              </button>
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#1c1c1f]"
                                onClick={() => handleDuplicateBoard(board)}
                              >
                                Duplicate
                              </button>
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#1c1c1f] rounded-b-xl"
                                onClick={() => handleDeleteBoard(board.id)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 mb-4">
                        {(board.columnColors || []).map((color, idx) => (
                          <div
                            key={`${board.id}-color-${idx}`}
                            className="h-1.5 w-12 bg-blue-500 rounded-full"
                            style={{ backgroundColor: color || undefined }}
                          ></div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <img
                            src={resolveBoardAvatar(board)}
                            className="presence-avatar w-8 h-8 rounded-full"
                            alt="Member"
                          />
                          {extraMembers > 0 ? (
                            <div className="presence-avatar w-8 h-8 rounded-full bg-[#2a2a2e] flex items-center justify-center text-xs font-semibold text-[#a1a1aa]">
                              +{extraMembers}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-xs text-[#a1a1aa]">{board.cardCount} cards</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section id="all-boards" className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">All Boards</h2>
                <div className="flex items-center space-x-3">
                  <button className="px-4 py-2 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl text-sm text-white hover:bg-[#2a2a2e] transition-all">
                    <i className="fa-solid fa-filter mr-2"></i>Filter
                  </button>
                  <button className="px-4 py-2 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl text-sm text-white hover:bg-[#2a2a2e] transition-all">
                    <i className="fa-solid fa-sort mr-2"></i>Sort
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-6">
                {allBoards.map((board) => {
                  const members = board.memberPreview || [];
                  const visibleMembers = members.slice(0, 3);
                  const extraMembers = members.length - visibleMembers.length;
                  const colors = board.columnColors || [];
                  return (
                    <div
                      key={`all-${board.id}`}
                      id={`board-card-${board.id}`}
                      className="board-card bg-[#141416] border border-[#2a2a2e] rounded-2xl p-6 cursor-pointer"
                      onClick={() => openBoard(board.id)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-2">{board.name}</h3>
                          <div className="flex items-center space-x-2 mb-3">
                            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold">
                              {board.boardType || 'Board'}
                            </span>
                          </div>
                        </div>
                        <div className="relative">
                          <button
                            className="text-[#a1a1aa] hover:text-white transition-all"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActionMenuBoardId(actionMenuBoardId === board.id ? null : board.id);
                            }}
                          >
                            <i className="fa-solid fa-ellipsis-vertical"></i>
                          </button>
                          {actionMenuBoardId === board.id ? (
                            <div
                              className="absolute right-0 mt-2 w-40 bg-[#141416] border border-[#2a2a2e] rounded-xl shadow-xl z-50"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#1c1c1f] rounded-t-xl"
                                onClick={() => handleEditBoard(board)}
                              >
                                Edit
                              </button>
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#1c1c1f]"
                                onClick={() => handleDuplicateBoard(board)}
                              >
                                Duplicate
                              </button>
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#1c1c1f] rounded-b-xl"
                                onClick={() => handleDeleteBoard(board.id)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 mb-4">
                        {colors.map((color, idx) => (
                          <div
                            key={`${board.id}-preview-${idx}`}
                            className="h-1.5 w-10 bg-blue-500 rounded-full"
                            style={{ backgroundColor: color || undefined }}
                          ></div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <img
                            src={resolveBoardAvatar(board)}
                            className="presence-avatar w-8 h-8 rounded-full"
                            alt="Member"
                          />
                          {extraMembers > 0 ? (
                            <div className="presence-avatar w-8 h-8 rounded-full bg-[#2a2a2e] flex items-center justify-center text-xs font-semibold text-[#a1a1aa]">
                              +{extraMembers}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-xs text-[#a1a1aa]">{board.cardCount} cards</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section id="templates-section" className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <i className="fa-solid fa-layer-group text-indigo-500"></i>
                  <span>Start from Template</span>
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-6">
                {primaryTemplates.map((template) => {
                  const accent = resolveTemplateAccent(template);
                  return (
                    <div
                      key={template.id}
                      id={`template-card-${template.id}`}
                      className={`${accent.wrapper} rounded-2xl p-6 cursor-pointer hover:border-indigo-500 transition-all`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 ${accent.icon} rounded-xl flex items-center justify-center mb-4`}>
                          <i className={`fa-solid ${accent.iconName} text-white text-xl`}></i>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{template.name}</h3>
                      <p className="text-sm text-[#a1a1aa] mb-4">Start with a proven workflow and customize as you go.</p>
                      <button
                        onClick={() => createFromTemplate(template.id)}
                        className={`w-full ${accent.button} text-white py-2.5 rounded-xl font-semibold transition-all`}
                      >
                        Use Template
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>

      <div id="create-board-modal" className={`fixed inset-0 z-50 ${showCreateBoardModal ? '' : 'hidden'}`}>
        <div className="drawer-overlay absolute inset-0 bg-black/60" onClick={closeCreateBoardModal}></div>
        <div className="modal-content relative z-10 max-w-2xl mx-auto mt-20">
          <div className="bg-[#141416] border border-[#2a2a2e] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-[#2a2a2e]">
              <h2 className="text-2xl font-bold text-white">Create New Board</h2>
              <button onClick={closeCreateBoardModal} className="text-[#a1a1aa] hover:text-white transition-all">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-white mb-2">Board Name</label>
                <input
                  type="text"
                  value={boardName}
                  onChange={(event) => setBoardName(event.target.value)}
                  placeholder="e.g., Q1 Sales Pipeline"
                  className="w-full bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl px-4 py-3 text-white placeholder-[#a1a1aa] focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-white mb-3">Choose a Template</label>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="bg-[#1c1c1f] border-2 border-[#2a2a2e] rounded-xl p-4 cursor-pointer hover:border-indigo-500 transition-all"
                    onClick={() => setSelectedTemplateId('recruiting_pipeline')}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <i className="fa-solid fa-users text-white"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-white">Recruiting Pipeline</div>
                        <div className="text-xs text-[#a1a1aa]">7 stages</div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="bg-[#1c1c1f] border-2 border-[#2a2a2e] rounded-xl p-4 cursor-pointer hover:border-purple-500 transition-all"
                    onClick={() => setSelectedTemplateId('client_acquisition')}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                        <i className="fa-solid fa-handshake text-white"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-white">Client Acquisition</div>
                        <div className="text-xs text-[#a1a1aa]">7 stages</div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="bg-[#1c1c1f] border-2 border-[#2a2a2e] rounded-xl p-4 cursor-pointer hover:border-green-500 transition-all"
                    onClick={() => setSelectedTemplateId('delivery_execution')}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                        <i className="fa-solid fa-rocket text-white"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-white">Delivery Execution</div>
                        <div className="text-xs text-[#a1a1aa]">7 stages</div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="bg-[#1c1c1f] border-2 border-indigo-500 rounded-xl p-4 cursor-pointer transition-all"
                    onClick={() => setSelectedTemplateId(null)}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 bg-[#2a2a2e] rounded-lg flex items-center justify-center">
                        <i className="fa-solid fa-table-columns text-white"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-white">Blank Board</div>
                        <div className="text-xs text-[#a1a1aa]">Start fresh</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 rounded bg-[#1c1c1f] border-[#2a2a2e] text-indigo-600 focus:ring-0" />
                  <span className="text-sm text-white">Allow guest collaborators</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-[#2a2a2e]">
              <button onClick={closeCreateBoardModal} className="px-6 py-2.5 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl text-white hover:bg-[#2a2a2e] transition-all">Cancel</button>
              <button onClick={createBoard} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all">Create Board</button>
            </div>
          </div>
        </div>
      </div>

      <div id="board-canvas-page" className={`fixed inset-0 z-40 bg-[#0a0a0b] ${showBoardCanvas ? '' : 'hidden'}`}>
        <div id="board-top-bar" className="bg-[#141416] border-b border-[#2a2a2e] px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={closeBoard} className="text-[#a1a1aa] hover:text-white transition-all">
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <div className="text-sm text-[#a1a1aa]">Boards /</div>
              <input type="text" defaultValue="Recruiting Pipeline 2024" className="bg-transparent text-xl font-bold text-white border-none focus:outline-none focus:bg-[#1c1c1f] px-3 py-1 rounded-lg transition-all" />
              <div className="flex items-center space-x-2">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" className="presence-avatar w-8 h-8 rounded-full" alt="Member" />
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" className="presence-avatar w-8 h-8 rounded-full" alt="Member" />
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg" className="presence-avatar w-8 h-8 rounded-full" alt="Member" />
                <div className="presence-avatar w-8 h-8 rounded-full bg-[#2a2a2e] flex items-center justify-center text-xs font-semibold text-[#a1a1aa]">+4</div>
                <div className="w-2 h-2 bg-green-500 rounded-full live-dot"></div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="relative">
                <input type="text" placeholder="Search cards..." className="w-64 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl px-4 py-2 pl-10 text-sm text-white placeholder-[#a1a1aa] focus:outline-none focus:border-indigo-500 transition-all" />
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] text-sm"></i>
              </div>
              <button onClick={openFilterPopover} className="px-4 py-2 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl text-sm text-white hover:bg-[#2a2a2e] transition-all">
                <i className="fa-solid fa-filter mr-2"></i>Filter
              </button>
              <button className="px-4 py-2 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl text-sm text-white hover:bg-[#2a2a2e] transition-all">
                <i className="fa-solid fa-bolt mr-2"></i>Automations
              </button>
              <button className="px-4 py-2 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl text-sm text-white hover:bg-[#2a2a2e] transition-all">
                <i className="fa-solid fa-eye mr-2"></i>View
              </button>
              <button onClick={openInviteModal} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all">
                <i className="fa-solid fa-user-plus mr-2"></i>Invite
              </button>
              <button className="text-[#a1a1aa] hover:text-white transition-all">
                <i className="fa-solid fa-ellipsis-vertical"></i>
              </button>
            </div>
          </div>
        </div>

        <div id="board-canvas" className="flex-1 overflow-x-auto overflow-y-hidden p-8 scrollbar-hide" style={{ height: 'calc(100vh - 72px)' }}>
          <div className="flex space-x-6 h-full">
            <div id="list-new-leads" className="list-column flex-shrink-0">
              <div className="bg-[#141416] border border-[#2a2a2e] rounded-2xl h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2e]">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <h3 className="font-bold text-white">New Leads</h3>
                    <span className="px-2 py-0.5 bg-[#1c1c1f] rounded-full text-xs text-[#a1a1aa]">18</span>
                  </div>
                  <button className="text-[#a1a1aa] hover:text-white transition-all">
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  <div className="kanban-card bg-[#1c1c1f] border border-[#2a2a2e] rounded-2xl p-4 cursor-pointer" onClick={() => openCardDrawer()}>
                    <div className="card-cover bg-blue-500 -mx-4 -mt-4 mb-3"></div>
                    <h4 className="font-semibold text-white mb-2">Sarah Chen - Senior Frontend Engineer</h4>
                    <p className="text-xs text-[#a1a1aa] mb-3">TechCorp Inc. • San Francisco</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="label-chip px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">Hot Lead</span>
                      <span className="label-chip px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-semibold">React</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" className="w-6 h-6 rounded-full" alt="Assignee" />
                        <span className="text-xs text-[#a1a1aa]">Due: Today</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[#a1a1aa]">
                        <i className="fa-solid fa-comment text-xs"></i>
                        <span className="text-xs">3</span>
                        <i className="fa-solid fa-paperclip text-xs ml-2"></i>
                        <span className="text-xs">2</span>
                      </div>
                    </div>
                    <div className="quick-action-btn absolute top-2 right-2 flex items-center space-x-1">
                      <button className="w-7 h-7 bg-[#141416] rounded-lg flex items-center justify-center hover:bg-[#2a2a2e] transition-all">
                        <i className="fa-solid fa-link text-xs text-white"></i>
                      </button>
                      <button className="w-7 h-7 bg-[#141416] rounded-lg flex items-center justify-center hover:bg-[#2a2a2e] transition-all">
                        <i className="fa-solid fa-tag text-xs text-white"></i>
                      </button>
                    </div>
                  </div>

                  <div className="kanban-card bg-[#1c1c1f] border border-[#2a2a2e] rounded-2xl p-4 cursor-pointer" onClick={() => openCardDrawer()}>
                    <h4 className="font-semibold text-white mb-2">Michael Rodriguez - DevOps Lead</h4>
                    <p className="text-xs text-[#a1a1aa] mb-3">CloudScale Systems • Remote</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="label-chip px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-semibold">AWS</span>
                      <span className="label-chip px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-xs font-semibold">Kubernetes</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" className="w-6 h-6 rounded-full" alt="Assignee" />
                        <span className="text-xs text-[#a1a1aa]">Due: Tomorrow</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[#a1a1aa]">
                        <i className="fa-solid fa-comment text-xs"></i>
                        <span className="text-xs">1</span>
                      </div>
                    </div>
                  </div>

                  <div className="kanban-card bg-[#1c1c1f] border border-[#2a2a2e] rounded-2xl p-4 cursor-pointer" onClick={() => openCardDrawer()}>
                    <div className="card-cover bg-indigo-500 -mx-4 -mt-4 mb-3"></div>
                    <h4 className="font-semibold text-white mb-2">Emily Watson - Product Designer</h4>
                    <p className="text-xs text-[#a1a1aa] mb-3">Design Studio • New York</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="label-chip px-2 py-1 bg-pink-500/20 text-pink-400 rounded-full text-xs font-semibold">UI/UX</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg" className="w-6 h-6 rounded-full" alt="Assignee" />
                      </div>
                      <div className="flex items-center space-x-2 text-[#a1a1aa]">
                        <i className="fa-solid fa-paperclip text-xs"></i>
                        <span className="text-xs">1</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-[#2a2a2e]">
                  <button className="w-full text-left text-sm text-[#a1a1aa] hover:text-white transition-all flex items-center space-x-2">
                    <i className="fa-solid fa-plus"></i>
                    <span>Add card</span>
                  </button>
                </div>
              </div>
            </div>

            <div id="list-contacted" className="list-column flex-shrink-0">
              <div className="bg-[#141416] border border-[#2a2a2e] rounded-2xl h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2e]">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <h3 className="font-bold text-white">Contacted</h3>
                    <span className="px-2 py-0.5 bg-[#1c1c1f] rounded-full text-xs text-[#a1a1aa]">12</span>
                  </div>
                  <button className="text-[#a1a1aa] hover:text-white transition-all">
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  <div className="kanban-card bg-[#1c1c1f] border border-[#2a2a2e] rounded-2xl p-4 cursor-pointer" onClick={() => openCardDrawer()}>
                    <h4 className="font-semibold text-white mb-2">James Park - Full Stack Developer</h4>
                    <p className="text-xs text-[#a1a1aa] mb-3">StartupXYZ • Austin</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="label-chip px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold">Node.js</span>
                      <span className="label-chip px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">MongoDB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" className="w-6 h-6 rounded-full" alt="Assignee" />
                        <span className="text-xs text-[#a1a1aa]">Due: 2 days</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[#a1a1aa]">
                        <i className="fa-solid fa-comment text-xs"></i>
                        <span className="text-xs">5</span>
                      </div>
                    </div>
                  </div>

                  <div className="kanban-card bg-[#1c1c1f] border border-[#2a2a2e] rounded-2xl p-4 cursor-pointer" onClick={() => openCardDrawer()}>
                    <div className="card-cover bg-purple-500 -mx-4 -mt-4 mb-3"></div>
                    <h4 className="font-semibold text-white mb-2">Lisa Anderson - Data Scientist</h4>
                    <p className="text-xs text-[#a1a1aa] mb-3">AI Labs • Boston</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="label-chip px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full text-xs font-semibold">Python</span>
                      <span className="label-chip px-2 py-1 bg-teal-500/20 text-teal-400 rounded-full text-xs font-semibold">ML</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg" className="w-6 h-6 rounded-full" alt="Assignee" />
                      </div>
                      <div className="flex items-center space-x-2 text-[#a1a1aa]">
                        <i className="fa-solid fa-comment text-xs"></i>
                        <span className="text-xs">2</span>
                        <i className="fa-solid fa-paperclip text-xs ml-2"></i>
                        <span className="text-xs">3</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-[#2a2a2e]">
                  <button className="w-full text-left text-sm text-[#a1a1aa] hover:text-white transition-all flex items-center space-x-2">
                    <i className="fa-solid fa-plus"></i>
                    <span>Add card</span>
                  </button>
                </div>
              </div>
            </div>

            <div id="list-replied" className="list-column flex-shrink-0">
              <div className="bg-[#141416] border border-[#2a2a2e] rounded-2xl h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2e]">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <h3 className="font-bold text-white">Replied</h3>
                    <span className="px-2 py-0.5 bg-[#1c1c1f] rounded-full text-xs text-[#a1a1aa]">8</span>
                  </div>
                  <button className="text-[#a1a1aa] hover:text-white transition-all">
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  <div className="kanban-card bg-[#1c1c1f] border border-[#2a2a2e] rounded-2xl p-4 cursor-pointer" onClick={() => openCardDrawer()}>
                    <h4 className="font-semibold text-white mb-2">David Kim - Backend Engineer</h4>
                    <p className="text-xs text-[#a1a1aa] mb-3">Enterprise Co. • Seattle</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="label-chip px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-semibold">Java</span>
                      <span className="label-chip px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold">Spring</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-4.jpg" className="w-6 h-6 rounded-full" alt="Assignee" />
                        <span className="text-xs text-[#a1a1aa]">Due: 3 days</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[#a1a1aa]">
                        <i className="fa-solid fa-comment text-xs"></i>
                        <span className="text-xs">7</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-[#2a2a2e]">
                  <button className="w-full text-left text-sm text-[#a1a1aa] hover:text-white transition-all flex items-center space-x-2">
                    <i className="fa-solid fa-plus"></i>
                    <span>Add card</span>
                  </button>
                </div>
              </div>
            </div>

            <div id="list-qualified" className="list-column flex-shrink-0">
              <div className="bg-[#141416] border border-[#2a2a2e] rounded-2xl h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2e]">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <h3 className="font-bold text-white">Qualified</h3>
                    <span className="px-2 py-0.5 bg-[#1c1c1f] rounded-full text-xs text-[#a1a1aa]">15</span>
                  </div>
                  <button className="text-[#a1a1aa] hover:text-white transition-all">
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  <div className="kanban-card bg-[#1c1c1f] border border-[#2a2a2e] rounded-2xl p-4 cursor-pointer" onClick={() => openCardDrawer()}>
                    <div className="card-cover bg-emerald-500 -mx-4 -mt-4 mb-3"></div>
                    <h4 className="font-semibold text-white mb-2">Rachel Green - iOS Developer</h4>
                    <p className="text-xs text-[#a1a1aa] mb-3">Mobile First • Miami</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="label-chip px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold">Swift</span>
                      <span className="label-chip px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">Hot Lead</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg" className="w-6 h-6 rounded-full" alt="Assignee" />
                        <span className="text-xs text-[#a1a1aa]">Due: 5 days</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[#a1a1aa]">
                        <i className="fa-solid fa-comment text-xs"></i>
                        <span className="text-xs">4</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-[#2a2a2e]">
                  <button className="w-full text-left text-sm text-[#a1a1aa] hover:text-white transition-all flex items-center space-x-2">
                    <i className="fa-solid fa-plus"></i>
                    <span>Add card</span>
                  </button>
                </div>
              </div>
            </div>

            <div id="list-interview" className="list-column flex-shrink-0">
              <div className="bg-[#141416] border border-[#2a2a2e] rounded-2xl h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2e]">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <h3 className="font-bold text-white">Interview</h3>
                    <span className="px-2 py-0.5 bg-[#1c1c1f] rounded-full text-xs text-[#a1a1aa]">6</span>
                  </div>
                  <button className="text-[#a1a1aa] hover:text-white transition-all">
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  <div className="kanban-card bg-[#1c1c1f] border border-[#2a2a2e] rounded-2xl p-4 cursor-pointer" onClick={() => openCardDrawer()}>
                    <h4 className="font-semibold text-white mb-2">Tom Martinez - Security Engineer</h4>
                    <p className="text-xs text-[#a1a1aa] mb-3">SecureNet • Chicago</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="label-chip px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-semibold">Security</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg" className="w-6 h-6 rounded-full" alt="Assignee" />
                        <span className="text-xs text-[#a1a1aa]">Due: 1 week</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[#a1a1aa]">
                        <i className="fa-solid fa-comment text-xs"></i>
                        <span className="text-xs">9</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-[#2a2a2e]">
                  <button className="w-full text-left text-sm text-[#a1a1aa] hover:text-white transition-all flex items-center space-x-2">
                    <i className="fa-solid fa-plus"></i>
                    <span>Add card</span>
                  </button>
                </div>
              </div>
            </div>

            <div id="list-offer" className="list-column flex-shrink-0">
              <div className="bg-[#141416] border border-[#2a2a2e] rounded-2xl h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2e]">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <h3 className="font-bold text-white">Offer</h3>
                    <span className="px-2 py-0.5 bg-[#1c1c1f] rounded-full text-xs text-[#a1a1aa]">4</span>
                  </div>
                  <button className="text-[#a1a1aa] hover:text-white transition-all">
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  <div className="kanban-card bg-[#1c1c1f] border border-[#2a2a2e] rounded-2xl p-4 cursor-pointer" onClick={() => openCardDrawer()}>
                    <div className="card-cover bg-purple-500 -mx-4 -mt-4 mb-3"></div>
                    <h4 className="font-semibold text-white mb-2">Anna Johnson - Product Manager</h4>
                    <p className="text-xs text-[#a1a1aa] mb-3">Innovation Labs • Portland</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="label-chip px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">Hot Lead</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-9.jpg" className="w-6 h-6 rounded-full" alt="Assignee" />
                      </div>
                      <div className="flex items-center space-x-2 text-[#a1a1aa]">
                        <i className="fa-solid fa-comment text-xs"></i>
                        <span className="text-xs">12</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-[#2a2a2e]">
                  <button className="w-full text-left text-sm text-[#a1a1aa] hover:text-white transition-all flex items-center space-x-2">
                    <i className="fa-solid fa-plus"></i>
                    <span>Add card</span>
                  </button>
                </div>
              </div>
            </div>

            <div id="list-hired" className="list-column flex-shrink-0">
              <div className="bg-[#141416] border border-[#2a2a2e] rounded-2xl h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2e]">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                    <h3 className="font-bold text-white">Hired</h3>
                    <span className="px-2 py-0.5 bg-[#1c1c1f] rounded-full text-xs text-[#a1a1aa]">23</span>
                  </div>
                  <button className="text-[#a1a1aa] hover:text-white transition-all">
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  <div className="kanban-card bg-[#1c1c1f] border border-[#2a2a2e] rounded-2xl p-4 cursor-pointer" onClick={() => openCardDrawer()}>
                    <div className="card-cover bg-pink-500 -mx-4 -mt-4 mb-3"></div>
                    <h4 className="font-semibold text-white mb-2">Chris Thompson - Tech Lead</h4>
                    <p className="text-xs text-[#a1a1aa] mb-3">Global Tech • Remote</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="label-chip px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">Hired</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" className="w-6 h-6 rounded-full" alt="Assignee" />
                      </div>
                      <div className="flex items-center space-x-2 text-[#a1a1aa]">
                        <i className="fa-solid fa-check-circle text-green-500"></i>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-[#2a2a2e]">
                  <button className="w-full text-left text-sm text-[#a1a1aa] hover:text-white transition-all flex items-center space-x-2">
                    <i className="fa-solid fa-plus"></i>
                    <span>Add card</span>
                  </button>
                </div>
              </div>
            </div>

            <div id="add-list-button" className="flex-shrink-0 w-80">
              <button className="w-full h-full bg-[#141416]/50 border-2 border-dashed border-[#2a2a2e] rounded-2xl flex items-center justify-center text-[#a1a1aa] hover:text-white hover:border-indigo-500 transition-all">
                <i className="fa-solid fa-plus mr-2"></i>
                <span className="font-semibold">Add List</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="card-drawer" className={`fixed inset-0 z-50 ${showCardDrawer ? '' : 'hidden'}`}>
        <div className="drawer-overlay absolute inset-0 bg-black/60" onClick={closeCardDrawer}></div>
        <div className="drawer-slide absolute right-0 top-0 bottom-0 w-[60%] bg-[#141416] shadow-2xl overflow-y-auto">
          <div className="sticky top-0 bg-[#141416] border-b border-[#2a2a2e] p-6 z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <input type="text" defaultValue="Sarah Chen - Senior Frontend Engineer" className="w-full bg-transparent text-2xl font-bold text-white border-none focus:outline-none focus:bg-[#1c1c1f] px-3 py-2 rounded-lg transition-all mb-3" />
                <div className="flex items-center space-x-2 mb-3">
                  <span className="label-chip px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-semibold cursor-pointer">Hot Lead</span>
                  <span className="label-chip px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-semibold cursor-pointer">React</span>
                  <button className="px-3 py-1 bg-[#1c1c1f] border border-[#2a2a2e] rounded-full text-sm text-[#a1a1aa] hover:text-white transition-all">
                    <i className="fa-solid fa-plus mr-1"></i>Add Label
                  </button>
                </div>
                <div className="text-sm text-[#a1a1aa]">in list <span className="text-white font-semibold">New Leads</span></div>
              </div>
              <button onClick={closeCardDrawer} className="text-[#a1a1aa] hover:text-white transition-all ml-4">
                <i className="fa-solid fa-xmark text-2xl"></i>
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-[#a1a1aa]">Assignees:</span>
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" className="w-8 h-8 rounded-full" alt="Assignee" />
                <button className="w-8 h-8 bg-[#1c1c1f] border border-[#2a2a2e] rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-white transition-all">
                  <i className="fa-solid fa-plus text-xs"></i>
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-[#a1a1aa]">Due:</span>
                <button className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm font-semibold">
                  <i className="fa-solid fa-clock mr-1"></i>Today
                </button>
              </div>
              <button className="px-4 py-2 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl text-sm text-white hover:bg-[#2a2a2e] transition-all">
                <i className="fa-solid fa-arrow-right mr-2"></i>Move
              </button>
              <button className="text-[#a1a1aa] hover:text-white transition-all ml-auto">
                <i className="fa-solid fa-ellipsis-vertical"></i>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div id="connected-entities-section">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                <i className="fa-solid fa-link text-indigo-500"></i>
                <span>Connected To</span>
              </h3>

              <div className="space-y-3">
                <div className="bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-user-tie text-white"></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-semibold text-indigo-400 uppercase">Lead</span>
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">Active</span>
                        </div>
                        <div className="font-semibold text-white mb-1">Sarah Chen</div>
                        <div className="text-sm text-[#a1a1aa]">TechCorp Inc. • Senior Frontend Engineer</div>
                        <div className="text-xs text-[#a1a1aa] mt-2">Last touch: 2 hours ago</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button className="px-3 py-1.5 bg-[#141416] border border-[#2a2a2e] rounded-lg text-xs text-white hover:bg-[#2a2a2e] transition-all">
                        Open
                      </button>
                      <button className="text-[#a1a1aa] hover:text-white transition-all">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-briefcase text-white"></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-semibold text-purple-400 uppercase">Opportunity</span>
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs font-semibold">In Progress</span>
                        </div>
                        <div className="font-semibold text-white mb-1">Frontend Developer - TechCorp</div>
                        <div className="text-sm text-[#a1a1aa]">$120k-$160k • Remote</div>
                        <div className="text-xs text-[#a1a1aa] mt-2">Created: 5 days ago</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button className="px-3 py-1.5 bg-[#141416] border border-[#2a2a2e] rounded-lg text-xs text-white hover:bg-[#2a2a2e] transition-all">
                        Open
                      </button>
                      <button className="text-[#a1a1aa] hover:text-white transition-all">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={openLinkEntityModal} className="w-full mt-3 py-3 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl text-sm text-white hover:bg-[#2a2a2e] transition-all flex items-center justify-center space-x-2">
                <i className="fa-solid fa-plus"></i>
                <span>Link Item</span>
              </button>
            </div>

            <div id="description-section">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center space-x-2">
                <i className="fa-solid fa-align-left text-indigo-500"></i>
                <span>Description</span>
              </h3>
              <textarea className="w-full bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl px-4 py-3 text-white placeholder-[#a1a1aa] focus:outline-none focus:border-indigo-500 transition-all resize-none" rows={6} placeholder="Add a more detailed description..." defaultValue="Experienced frontend developer with 5+ years in React. Looking for remote opportunities. Previous experience at major tech companies. Strong portfolio of modern web applications."></textarea>
            </div>

            <div id="checklist-section">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-check-square text-indigo-500"></i>
                  <span>Checklist</span>
                </div>
                <span className="text-sm text-[#a1a1aa]">3/5 completed</span>
              </h3>

              <div className="mb-3">
                <div className="h-2 bg-[#1c1c1f] rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-3 p-3 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl cursor-pointer hover:bg-[#2a2a2e] transition-all">
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded bg-[#141416] border-[#2a2a2e] text-indigo-600 focus:ring-0" />
                  <span className="text-white line-through">Initial phone screening</span>
                </label>
                <label className="flex items-center space-x-3 p-3 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl cursor-pointer hover:bg-[#2a2a2e] transition-all">
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded bg-[#141416] border-[#2a2a2e] text-indigo-600 focus:ring-0" />
                  <span className="text-white line-through">Review portfolio</span>
                </label>
                <label className="flex items-center space-x-3 p-3 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl cursor-pointer hover:bg-[#2a2a2e] transition-all">
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded bg-[#141416] border-[#2a2a2e] text-indigo-600 focus:ring-0" />
                  <span className="text-white line-through">Technical assessment</span>
                </label>
                <label className="flex items-center space-x-3 p-3 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl cursor-pointer hover:bg-[#2a2a2e] transition-all">
                  <input type="checkbox" className="w-5 h-5 rounded bg-[#141416] border-[#2a2a2e] text-indigo-600 focus:ring-0" />
                  <span className="text-white">Schedule client interview</span>
                </label>
                <label className="flex items-center space-x-3 p-3 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl cursor-pointer hover:bg-[#2a2a2e] transition-all">
                  <input type="checkbox" className="w-5 h-5 rounded bg-[#141416] border-[#2a2a2e] text-indigo-600 focus:ring-0" />
                  <span className="text-white">Prepare offer package</span>
                </label>
              </div>

              <button className="w-full mt-3 py-2.5 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl text-sm text-white hover:bg-[#2a2a2e] transition-all">
                <i className="fa-solid fa-plus mr-2"></i>Add Item
              </button>
            </div>

            <div id="comments-section">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                <i className="fa-solid fa-comments text-indigo-500"></i>
                <span>Comments & Activity</span>
              </h3>

              <div className="flex items-start space-x-3 mb-6">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" className="w-10 h-10 rounded-full flex-shrink-0" alt="User" />
                <div className="flex-1">
                  <textarea className="w-full bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl px-4 py-3 text-white placeholder-[#a1a1aa] focus:outline-none focus:border-indigo-500 transition-all resize-none" rows={3} placeholder="Write a comment..."></textarea>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2">
                      <button className="text-sm text-[#a1a1aa] hover:text-white transition-all">
                        <i className="fa-solid fa-at"></i>
                      </button>
                      <button className="text-sm text-[#a1a1aa] hover:text-white transition-all">
                        <i className="fa-solid fa-paperclip"></i>
                      </button>
                    </div>
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all">
                      Post
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" className="w-10 h-10 rounded-full flex-shrink-0" alt="User" />
                  <div className="flex-1">
                    <div className="bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white">Jessica Lee</span>
                          <span className="text-xs text-[#a1a1aa]">2 hours ago</span>
                        </div>
                        <button className="text-[#a1a1aa] hover:text-white transition-all">
                          <i className="fa-solid fa-ellipsis-vertical text-sm"></i>
                        </button>
                      </div>
                      <p className="text-sm text-white">Just had a great call with Sarah. She's very interested in the role and has impressive React experience. Moving to next stage.</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-full bg-[#2a2a2e] flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-robot text-[#a1a1aa]"></i>
                  </div>
                  <div className="flex-1">
                    <div className="bg-[#1c1c1f]/50 border border-[#2a2a2e] rounded-xl p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-[#a1a1aa]">System</span>
                        <span className="text-xs text-[#a1a1aa]">5 hours ago</span>
                      </div>
                      <p className="text-sm text-[#a1a1aa]">Card moved from <span className="text-white font-semibold">Contacted</span> to <span className="text-white font-semibold">New Leads</span></p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" className="w-10 h-10 rounded-full flex-shrink-0" alt="User" />
                  <div className="flex-1">
                    <div className="bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white">Alex Rivera</span>
                          <span className="text-xs text-[#a1a1aa]">1 day ago</span>
                        </div>
                        <button className="text-[#a1a1aa] hover:text-white transition-all">
                          <i className="fa-solid fa-ellipsis-vertical text-sm"></i>
                        </button>
                      </div>
                      <p className="text-sm text-white">Added Sarah to the pipeline. She looks like a strong match for TechCorp's frontend role.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="link-entity-modal" className={`fixed inset-0 z-50 ${showLinkEntityModal ? '' : 'hidden'}`}>
        <div className="drawer-overlay absolute inset-0 bg-black/60" onClick={closeLinkEntityModal}></div>
        <div className="modal-content relative z-10 max-w-3xl mx-auto mt-20">
          <div className="bg-[#141416] border border-[#2a2a2e] rounded-2xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#2a2a2e]">
              <h2 className="text-2xl font-bold text-white">Link Item</h2>
              <button onClick={closeLinkEntityModal} className="text-[#a1a1aa] hover:text-white transition-all">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="flex border-b border-[#2a2a2e]">
              <button className="flex-1 px-6 py-4 text-sm font-semibold text-white bg-[#1c1c1f] border-b-2 border-indigo-500">
                <i className="fa-solid fa-user-tie mr-2"></i>Leads
              </button>
              <button className="flex-1 px-6 py-4 text-sm font-semibold text-[#a1a1aa] hover:text-white transition-all">
                <i className="fa-solid fa-users mr-2"></i>Candidates
              </button>
              <button className="flex-1 px-6 py-4 text-sm font-semibold text-[#a1a1aa] hover:text-white transition-all">
                <i className="fa-solid fa-briefcase mr-2"></i>Opportunities
              </button>
              <button className="flex-1 px-6 py-4 text-sm font-semibold text-[#a1a1aa] hover:text-white transition-all">
                <i className="fa-solid fa-table mr-2"></i>Tables
              </button>
            </div>

            <div className="p-6">
              <div className="relative mb-4">
                <input type="text" placeholder="Search..." className="w-full bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl px-4 py-3 pl-10 text-white placeholder-[#a1a1aa] focus:outline-none focus:border-indigo-500 transition-all" />
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]"></i>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
                <div className="bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl p-4 cursor-pointer hover:border-indigo-500 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <i className="fa-solid fa-user-tie text-white"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-white">John Smith</div>
                        <div className="text-sm text-[#a1a1aa]">Acme Corp • CTO</div>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all">
                      Link
                    </button>
                  </div>
                </div>

                <div className="bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl p-4 cursor-pointer hover:border-indigo-500 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <i className="fa-solid fa-user-tie text-white"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-white">Maria Garcia</div>
                        <div className="text-sm text-[#a1a1aa]">Tech Innovations • VP Engineering</div>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all">
                      Link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="invite-modal" className={`fixed inset-0 z-50 ${showInviteModal ? '' : 'hidden'}`}>
        <div className="drawer-overlay absolute inset-0 bg-black/60" onClick={closeInviteModal}></div>
        <div className="modal-content relative z-10 max-w-2xl mx-auto mt-20">
          <div className="bg-[#141416] border border-[#2a2a2e] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-[#2a2a2e]">
              <h2 className="text-2xl font-bold text-white">Invite to Board</h2>
              <button onClick={closeInviteModal} className="text-[#a1a1aa] hover:text-white transition-all">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="flex border-b border-[#2a2a2e]">
              <button className="flex-1 px-6 py-4 text-sm font-semibold text-white bg-[#1c1c1f] border-b-2 border-indigo-500">
                Team Members
              </button>
              <button className="flex-1 px-6 py-4 text-sm font-semibold text-[#a1a1aa] hover:text-white transition-all">
                Guests
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-white mb-2">Email Address</label>
                <input type="email" placeholder="colleague@company.com" className="w-full bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl px-4 py-3 text-white placeholder-[#a1a1aa] focus:outline-none focus:border-indigo-500 transition-all" />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-white mb-2">Role</label>
                <select className="w-full bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all">
                  <option>Editor - Can edit cards and lists</option>
                  <option>Commenter - Can view and comment</option>
                  <option>Viewer - Can only view</option>
                </select>
              </div>

              <div className="bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <i className="fa-solid fa-info-circle text-indigo-500 mt-1"></i>
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">Guest Collaboration</div>
                    <div className="text-sm text-[#a1a1aa]">Upgrade to invite guest collaborators from outside your organization.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-[#2a2a2e]">
              <button onClick={closeInviteModal} className="px-6 py-2.5 bg-[#1c1c1f] border border-[#2a2a2e] rounded-xl text-white hover:bg-[#2a2a2e] transition-all">Cancel</button>
              <button className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all">Send Invite</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

