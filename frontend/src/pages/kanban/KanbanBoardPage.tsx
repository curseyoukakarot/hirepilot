import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import type { KanbanBoard, KanbanCard } from '../../shared/kanbanTypes';

export default function KanbanBoardPage() {
  const navigate = useNavigate();
  const { boardId } = useParams();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedCard, setSelectedCard] = React.useState<KanbanCard | null>(null);
  const [board, setBoard] = React.useState<KanbanBoard | null>(null);
  const [search, setSearch] = React.useState('');

  const openDrawer = (cardOrEvent?: KanbanCard | React.MouseEvent, event?: React.MouseEvent) => {
    const actualEvent = (cardOrEvent as React.MouseEvent)?.preventDefault ? (cardOrEvent as React.MouseEvent) : event;
    if (actualEvent && (actualEvent.target as HTMLElement).closest('button')) return;
    const card = (cardOrEvent as KanbanCard)?.id ? (cardOrEvent as KanbanCard) : undefined;
    setSelectedCard(card || null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => setDrawerOpen(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!boardId) return;
        const response = await apiGet(`/api/boards/${boardId}`);
        const nextBoard = (response as any)?.board as KanbanBoard | undefined;
        if (mounted) setBoard(nextBoard || null);
      } catch (err) {
        console.error(err);
        if (mounted) setBoard(null);
      } finally {
        if (!mounted) return;
      }
    })();
    return () => {
      mounted = false;
    };
  }, [boardId]);

  const lists = React.useMemo(() => {
    const data = board?.lists ? [...board.lists] : [];
    data.sort((a, b) => a.position - b.position);
    return data;
  }, [board]);

  const filteredLists = React.useMemo(() => {
    if (!search.trim()) return lists;
    const query = search.trim().toLowerCase();
    return lists.map((list) => ({
      ...list,
      cards: list.cards.filter((card) => card.title.toLowerCase().includes(query)),
    }));
  }, [lists, search]);

  const selectedList = React.useMemo(() => {
    if (!selectedCard) return null;
    return lists.find((list) => list.cards.some((card) => card.id === selectedCard.id)) || null;
  }, [lists, selectedCard]);

  const boardMembers = board?.members || [];
  const visibleMembers = boardMembers.slice(0, 3);
  const overflowMembers = boardMembers.length - visibleMembers.length;

  return (
    <div className="bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 text-gray-100 font-sans">
      <style>{`
        .bg-dark-900 { background-color: #0a0a0f; }
        .bg-dark-800 { background-color: #13131a; }
        .bg-dark-700 { background-color: #1a1a24; }
        .bg-dark-600 { background-color: #23232f; }
        .bg-dark-900\\/80 { background-color: rgba(10,10,15,0.8); }
        .bg-dark-900\\/95 { background-color: rgba(10,10,15,0.95); }
        .bg-dark-800\\/40 { background-color: rgba(19,19,26,0.4); }
        .bg-dark-800\\/60 { background-color: rgba(19,19,26,0.6); }
        .bg-dark-700\\/50 { background-color: rgba(26,26,36,0.5); }
        .bg-dark-700\\/60 { background-color: rgba(26,26,36,0.6); }
        .bg-dark-800\\/20 { background-color: rgba(19,19,26,0.2); }
        .from-dark-900 {
          --tw-gradient-from: #0a0a0f;
          --tw-gradient-to: rgba(10,10,15,0);
          --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);
        }
        .via-dark-800 {
          --tw-gradient-to: rgba(19,19,26,0);
          --tw-gradient-stops: var(--tw-gradient-from), #13131a, var(--tw-gradient-to);
        }
        .to-dark-900 { --tw-gradient-to: #0a0a0f; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      <header id="board-header" className="sticky top-0 z-50 backdrop-blur-xl bg-dark-900/80 border-b border-white/5">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('/kanban')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
                <i className="fa-solid fa-arrow-left text-sm group-hover:-translate-x-0.5 transition-transform"></i>
                <span className="text-sm font-medium">Boards</span>
              </button>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  defaultValue={board?.name || 'Untitled Board'}
                  className="bg-transparent text-xl font-semibold text-white border-none outline-none focus:bg-dark-700/50 px-3 py-1 rounded-lg transition-all"
                />
                <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-medium rounded-full border border-indigo-500/20">
                  {board?.boardType || 'Board'}
                </span>
              </div>

              <div className="flex items-center -space-x-2 ml-2">
                {visibleMembers.map((member) => (
                  <img
                    key={member.id}
                    src={member.user?.avatarUrl || 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg'}
                    className="w-8 h-8 rounded-full border-2 border-dark-800 hover:scale-110 transition-transform cursor-pointer"
                  />
                ))}
                {overflowMembers > 0 ? (
                  <div className="w-8 h-8 rounded-full border-2 border-dark-800 bg-dark-700 flex items-center justify-center text-xs font-medium text-gray-400 hover:scale-110 transition-transform cursor-pointer">
                    +{overflowMembers}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search cards..."
                  className="bg-dark-700/50 border border-white/5 rounded-lg px-4 py-2 pl-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-dark-700 transition-all w-64"
                />
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
              </div>

              <button className="px-4 py-2 bg-dark-700/50 hover:bg-dark-700 border border-white/5 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-all flex items-center gap-2">
                <i className="fa-solid fa-filter text-xs"></i>
                Filter
              </button>

              <button className="px-4 py-2 bg-dark-700/50 hover:bg-dark-700 border border-white/5 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-all flex items-center gap-2">
                <i className="fa-solid fa-bolt text-xs text-amber-400"></i>
                Automations
              </button>

              <button className="px-4 py-2 bg-dark-700/50 hover:bg-dark-700 border border-white/5 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-all flex items-center gap-2">
                <i className="fa-solid fa-table text-xs"></i>
                View
              </button>

              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-all flex items-center gap-2">
                <i className="fa-solid fa-user-plus text-xs"></i>
                Invite
              </button>

              <button className="px-3 py-2 bg-dark-700/50 hover:bg-dark-700 border border-white/5 rounded-lg text-gray-400 hover:text-white transition-all">
                <i className="fa-solid fa-ellipsis text-sm"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main id="kanban-canvas" className="px-6 py-8 overflow-x-auto">
        <div className="flex gap-5 min-w-max pb-8">
          {filteredLists.map((list) => (
            <div key={list.id} id={`column-${list.id}`} className="flex-shrink-0 w-80">
              <div className="bg-dark-800/40 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-6 bg-blue-500 rounded-full" style={{ backgroundColor: list.color || undefined }}></div>
                    <input
                      type="text"
                      defaultValue={list.name}
                      className="bg-transparent text-base font-semibold text-white border-none outline-none focus:bg-dark-700/50 px-2 py-1 rounded"
                    />
                    <span className="text-sm text-gray-500 font-medium">{list.cards.length}</span>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white">
                    <i className="fa-solid fa-ellipsis text-sm"></i>
                  </button>
                </div>

                <div className="p-3 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {list.cards.map((card) => (
                    <div
                      key={card.id}
                      className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative"
                      onClick={(event) => openDrawer(card, event)}
                    >
                      <div
                        className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-xl"
                        style={{ background: card.coverColor || undefined }}
                      ></div>

                      <h4 className="text-white font-semibold text-sm mb-2 leading-snug">{card.title}</h4>
                      <p className="text-gray-400 text-xs mb-3">
                        {[(card as any).companyName, (card as any).location].filter(Boolean).join(' · ')}
                      </p>

                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {(card.labels || []).map((label) => (
                          <span
                            key={label.id}
                            className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded border border-emerald-500/20 flex items-center gap-1"
                            style={{
                              color: label.color || undefined,
                              borderColor: label.color ? `${label.color}33` : undefined,
                              backgroundColor: label.color ? `${label.color}1a` : undefined,
                            }}
                          >
                            <i className="fa-solid fa-tag text-[10px]"></i>
                            {label.name}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
                            className="w-6 h-6 rounded-full border border-white/10"
                          />
                          <span className="text-xs text-gray-400 flex items-center gap-1.5">
                            <i className="fa-solid fa-comment text-[10px]"></i>
                            {card.comments?.length || 0}
                          </span>
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                            <i className="fa-solid fa-link text-xs"></i>
                          </button>
                          <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                            <i className="fa-solid fa-tag text-xs"></i>
                          </button>
                          <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                            <i className="fa-solid fa-user text-xs"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 border-t border-white/5">
                  <button className="w-full py-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2">
                    <i className="fa-solid fa-plus text-xs"></i>
                    Add card
                  </button>
                </div>
              </div>
            </div>
          ))}
          {false && (
          <>
          <div id="column-new-leads" className="flex-shrink-0 w-80">
            <div className="bg-dark-800/40 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                  <input type="text" defaultValue="New Leads" className="bg-transparent text-base font-semibold text-white border-none outline-none focus:bg-dark-700/50 px-2 py-1 rounded" />
                  <span className="text-sm text-gray-500 font-medium">42</span>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white">
                  <i className="fa-solid fa-ellipsis text-sm"></i>
                </button>
              </div>

              <div className="p-3 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                <div className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative" onClick={openDrawer}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-xl"></div>

                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">Senior Backend Engineer – Fintech</h4>
                  <p className="text-gray-400 text-xs mb-3">Stripe · SF · Remote</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded border border-emerald-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      Qualified
                    </span>
                    <span className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs font-medium rounded border border-orange-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-clock text-[10px]"></i>
                      Tomorrow
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment text-[10px]"></i>
                        3
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-user text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative" onClick={openDrawer}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-xl"></div>

                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">Product Designer – B2B SaaS</h4>
                  <p className="text-gray-400 text-xs mb-3">Notion · NYC · Hybrid</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs font-medium rounded border border-purple-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      New
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment text-[10px]"></i>
                        1
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-user text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative" onClick={openDrawer}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-xl"></div>

                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">DevOps Engineer – Cloud Infrastructure</h4>
                  <p className="text-gray-400 text-xs mb-3">Datadog · Remote</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded border border-amber-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      Reviewing
                    </span>
                    <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs font-medium rounded border border-red-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-clock text-[10px]"></i>
                      Overdue
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment text-[10px]"></i>
                        7
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-user text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border-t border-white/5">
                <button className="w-full py-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus text-xs"></i>
                  Add card
                </button>
              </div>
            </div>
          </div>

          <div id="column-contacted" className="flex-shrink-0 w-80">
            <div className="bg-dark-800/40 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                  <input type="text" defaultValue="Contacted" className="bg-transparent text-base font-semibold text-white border-none outline-none focus:bg-dark-700/50 px-2 py-1 rounded" />
                  <span className="text-sm text-gray-500 font-medium">28</span>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white">
                  <i className="fa-solid fa-ellipsis text-sm"></i>
                </button>
              </div>

              <div className="p-3 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                <div className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative" onClick={openDrawer}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-t-xl"></div>

                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">Full Stack Developer – E-commerce</h4>
                  <p className="text-gray-400 text-xs mb-3">Shopify · Toronto · Remote</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-xs font-medium rounded border border-cyan-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      Interested
                    </span>
                    <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded border border-blue-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-clock text-[10px]"></i>
                      Today
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-4.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment text-[10px]"></i>
                        5
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-user text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative" onClick={openDrawer}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-t-xl"></div>

                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">Data Scientist – Machine Learning</h4>
                  <p className="text-gray-400 text-xs mb-3">UX Pilot AI · San Francisco · Onsite</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded border border-emerald-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      Qualified
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment text-[10px]"></i>
                        2
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-user text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border-t border-white/5">
                <button className="w-full py-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus text-xs"></i>
                  Add card
                </button>
              </div>
            </div>
          </div>

          <div id="column-interview" className="flex-shrink-0 w-80">
            <div className="bg-dark-800/40 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
                  <input type="text" defaultValue="Interview" className="bg-transparent text-base font-semibold text-white border-none outline-none focus:bg-dark-700/50 px-2 py-1 rounded" />
                  <span className="text-sm text-gray-500 font-medium">15</span>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white">
                  <i className="fa-solid fa-ellipsis text-sm"></i>
                </button>
              </div>

              <div className="p-3 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                <div className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative" onClick={openDrawer}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-600 rounded-t-xl"></div>

                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">Engineering Manager – Platform</h4>
                  <p className="text-gray-400 text-xs mb-3">Airbnb · SF · Hybrid</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-1 bg-violet-500/10 text-violet-400 text-xs font-medium rounded border border-violet-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      2nd Round
                    </span>
                    <span className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs font-medium rounded border border-orange-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-clock text-[10px]"></i>
                      Friday
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-9.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment text-[10px]"></i>
                        12
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-user text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative" onClick={openDrawer}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-600 rounded-t-xl"></div>

                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">Security Engineer – AppSec</h4>
                  <p className="text-gray-400 text-xs mb-3">Cloudflare · Austin · Remote</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-1 bg-pink-500/10 text-pink-400 text-xs font-medium rounded border border-pink-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      Technical
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment text-[10px]"></i>
                        4
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-user text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border-t border-white/5">
                <button className="w-full py-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus text-xs"></i>
                  Add card
                </button>
              </div>
            </div>
          </div>

          <div id="column-offer" className="flex-shrink-0 w-80">
            <div className="bg-dark-800/40 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                  <input type="text" defaultValue="Offer" className="bg-transparent text-base font-semibold text-white border-none outline-none focus:bg-dark-700/50 px-2 py-1 rounded" />
                  <span className="text-sm text-gray-500 font-medium">8</span>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white">
                  <i className="fa-solid fa-ellipsis text-sm"></i>
                </button>
              </div>

              <div className="p-3 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                <div className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative" onClick={openDrawer}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-xl"></div>

                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">Lead UX Researcher – Consumer</h4>
                  <p className="text-gray-400 text-xs mb-3">Meta · Menlo Park · Onsite</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded border border-emerald-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      Offer Sent
                    </span>
                    <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded border border-amber-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-clock text-[10px]"></i>
                      Awaiting
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment text-[10px]"></i>
                        8
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-user text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative" onClick={openDrawer}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-xl"></div>

                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">VP of Engineering – Infrastructure</h4>
                  <p className="text-gray-400 text-xs mb-3">Uber · SF · Hybrid</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-xs font-medium rounded border border-cyan-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      Negotiating
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment text-[10px]"></i>
                        15
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-user text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border-t border-white/5">
                <button className="w-full py-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus text-xs"></i>
                  Add card
                </button>
              </div>
            </div>
          </div>

          <div id="column-hired" className="flex-shrink-0 w-80">
            <div className="bg-dark-800/40 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-green-500 rounded-full"></div>
                  <input type="text" defaultValue="Hired" className="bg-transparent text-base font-semibold text-white border-none outline-none focus:bg-dark-700/50 px-2 py-1 rounded" />
                  <span className="text-sm text-gray-500 font-medium">12</span>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white">
                  <i className="fa-solid fa-ellipsis text-sm"></i>
                </button>
              </div>

              <div className="p-3 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                <div className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative" onClick={openDrawer}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-600 rounded-t-xl"></div>

                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">Senior iOS Engineer – Consumer App</h4>
                  <p className="text-gray-400 text-xs mb-3">Instagram · NYC · Hybrid</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded border border-green-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-check text-[10px]"></i>
                      Accepted
                    </span>
                    <span className="text-xs text-gray-500">Start: Jan 15</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-4.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment text-[10px]"></i>
                        6
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-user text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group relative" onClick={openDrawer}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-600 rounded-t-xl"></div>

                  <h4 className="text-white font-semibold text-sm mb-2 leading-snug">Growth Marketing Lead</h4>
                  <p className="text-gray-400 text-xs mb-3">Spotify · Stockholm · Onsite</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded border border-green-500/20 flex items-center gap-1">
                      <i className="fa-solid fa-check text-[10px]"></i>
                      Onboarding
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment text-[10px]"></i>
                        9
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </button>
                      <button className="w-7 h-7 bg-dark-600 hover:bg-dark-500 rounded flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i className="fa-solid fa-user text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border-t border-white/5">
                <button className="w-full py-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus text-xs"></i>
                  Add card
                </button>
              </div>
            </div>
          </div>
          </>
          )}

          <div className="flex-shrink-0 w-80">
            <button className="w-full h-14 bg-dark-800/20 hover:bg-dark-800/40 border-2 border-dashed border-white/5 hover:border-white/10 rounded-2xl text-gray-500 hover:text-gray-300 text-sm font-medium transition-all flex items-center justify-center gap-2">
              <i className="fa-solid fa-plus text-xs"></i>
              Add column
            </button>
          </div>
        </div>
      </main>

      <div id="card-drawer" className={`fixed top-0 right-0 w-[55%] h-full bg-dark-900/95 backdrop-blur-xl border-l border-white/5 transform transition-transform duration-300 overflow-y-auto z-50 shadow-2xl ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <input
                type="text"
                defaultValue={selectedCard?.title || 'Untitled Card'}
                className="w-full bg-transparent text-2xl font-bold text-white border-none outline-none focus:bg-dark-800/50 px-3 py-2 rounded-lg mb-4"
              />

              <div className="flex items-center gap-3 flex-wrap mb-4">
                {(selectedCard?.labels || []).map((label) => (
                  <span
                    key={label.id}
                    className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-sm font-medium rounded-lg border border-emerald-500/20 flex items-center gap-2"
                    style={{
                      color: label.color || undefined,
                      borderColor: label.color ? `${label.color}33` : undefined,
                      backgroundColor: label.color ? `${label.color}1a` : undefined,
                    }}
                  >
                    <i className="fa-solid fa-tag text-xs"></i>
                    {label.name}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">in list</span>
                  <button className="px-3 py-1 bg-dark-700/50 hover:bg-dark-700 rounded-md text-gray-300 font-medium transition-all">
                    {selectedList?.name || 'Unassigned'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">assigned to</span>
                  <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" className="w-6 h-6 rounded-full border border-white/10" />
                </div>
              </div>
            </div>

            <button onClick={closeDrawer} className="w-10 h-10 bg-dark-800 hover:bg-dark-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          <div id="connected-section" className="mb-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <i className="fa-solid fa-link text-xs"></i>
              Connected To
            </h3>

            <div className="space-y-3 mb-4">
              <div className="bg-dark-800/60 border border-white/5 rounded-xl p-4 hover:bg-dark-800 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 flex-shrink-0">
                      <i className="fa-solid fa-link"></i>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Linked Item</div>
                      <div className="text-sm font-semibold text-white mb-1">
                        {(selectedCard as any)?.sourceType ? `${(selectedCard as any).sourceType} link` : 'No linked items'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {(selectedCard as any)?.sourceRef?.objectId || 'Connect a lead, candidate, or table row'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-md text-xs font-medium text-gray-300 transition-all">
                      Open
                    </button>
                    <button className="w-8 h-8 bg-dark-700 hover:bg-dark-600 rounded-md flex items-center justify-center text-gray-400 hover:text-white transition-all">
                      <i className="fa-solid fa-link-slash text-xs"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button className="w-full py-3 bg-dark-800/60 hover:bg-dark-800 border border-white/5 rounded-xl text-sm font-medium text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2">
              <i className="fa-solid fa-plus text-xs"></i>
              Link item
            </button>
          </div>

          <div id="description-section" className="mb-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <i className="fa-solid fa-align-left text-xs"></i>
              Description
            </h3>
            <textarea
              className="w-full bg-dark-800/60 border border-white/5 rounded-xl p-4 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-dark-800 transition-all resize-none"
              rows={6}
              placeholder="Add a more detailed description..."
              defaultValue={(selectedCard as any)?.description || ''}
            ></textarea>
          </div>

          <div id="checklist-section" className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-list-check text-xs"></i>
                Checklist
              </h3>
              <span className="text-xs text-gray-500">3/5 completed</span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="p-3 bg-dark-800/60 border border-white/5 rounded-lg text-sm text-gray-400">
                No checklist items yet.
              </div>
            </div>

            <button className="w-full py-2.5 bg-dark-800/60 hover:bg-dark-800 border border-white/5 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2">
              <i className="fa-solid fa-plus text-xs"></i>
              Add item
            </button>
          </div>

          <div id="activity-section" className="mb-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <i className="fa-solid fa-message text-xs"></i>
              Activity
            </h3>

            <div className="mb-6">
              <div className="flex items-start gap-3">
                <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" className="w-9 h-9 rounded-full border border-white/10 flex-shrink-0" />
                <div className="flex-1">
                  <textarea className="w-full bg-dark-800/60 border border-white/5 rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-dark-800 transition-all resize-none" rows={3} placeholder="Write a comment..."></textarea>
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-all">
                      Comment
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-dark-800/60 border border-white/5 rounded-lg text-sm text-gray-400">
                Activity will appear here as teammates comment or move cards.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

