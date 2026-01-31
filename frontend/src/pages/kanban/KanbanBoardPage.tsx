import React from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import type { KanbanBoard, KanbanCard } from '../../shared/kanbanTypes';

type CardLink = {
  id: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

type ChecklistItem = {
  id: string;
  body: string;
  isCompleted: boolean;
  createdAt: string;
};

type CardComment = {
  id: string;
  body: string;
  createdAt: string;
  author?: { fullName?: string | null; avatarUrl?: string | null };
};

function formatTimestamp(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleString();
}

export default function KanbanBoardPage() {
  const navigate = useNavigate();
  const { boardId } = useParams();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedCard, setSelectedCard] = React.useState<KanbanCard | null>(null);
  const [board, setBoard] = React.useState<KanbanBoard | null>(null);
  const [search, setSearch] = React.useState('');
  const [showAddColumnModal, setShowAddColumnModal] = React.useState(false);
  const [newColumnName, setNewColumnName] = React.useState('');
  const [newColumnColor, setNewColumnColor] = React.useState('#6366f1');
  const [newColumnCards, setNewColumnCards] = React.useState('');
  const [showAddCardModal, setShowAddCardModal] = React.useState(false);
  const [addCardListId, setAddCardListId] = React.useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = React.useState('');
  const [newCardDescription, setNewCardDescription] = React.useState('');
  const [cardTitleDraft, setCardTitleDraft] = React.useState('');
  const [cardDescriptionDraft, setCardDescriptionDraft] = React.useState('');
  const [cardLinks, setCardLinks] = React.useState<CardLink[]>([]);
  const [linkEntityType, setLinkEntityType] = React.useState('lead');
  const [linkEntityId, setLinkEntityId] = React.useState('');
  const [checklistItems, setChecklistItems] = React.useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = React.useState('');
  const [commentBody, setCommentBody] = React.useState('');
  const [comments, setComments] = React.useState<CardComment[]>([]);

  const openDrawer = (cardOrEvent?: KanbanCard | React.MouseEvent, event?: React.MouseEvent) => {
    const actualEvent = (cardOrEvent as React.MouseEvent)?.preventDefault ? (cardOrEvent as React.MouseEvent) : event;
    if (actualEvent && (actualEvent.target as HTMLElement).closest('button')) return;
    const card = (cardOrEvent as KanbanCard)?.id ? (cardOrEvent as KanbanCard) : undefined;
    setSelectedCard(card || null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => setDrawerOpen(false);

  const loadBoard = React.useCallback(async () => {
    if (!boardId) return;
    const response = await apiGet(`/api/boards/${boardId}`);
    const nextBoard = (response as any)?.board as KanbanBoard | undefined;
    setBoard(nextBoard || null);
  }, [boardId]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadBoard();
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
  }, [loadBoard]);

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

  React.useEffect(() => {
    if (!selectedCard) return;
    setCardTitleDraft(selectedCard.title || '');
    setCardDescriptionDraft(selectedCard.description || '');
  }, [selectedCard]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedCard?.id) return;
      try {
        const [linksRes, checklistRes, commentsRes] = await Promise.all([
          apiGet(`/api/cards/${selectedCard.id}/links`),
          apiGet(`/api/cards/${selectedCard.id}/checklist`),
          apiGet(`/api/cards/${selectedCard.id}/comments`),
        ]);
        if (!mounted) return;
        setCardLinks((linksRes as any)?.links || []);
        setChecklistItems((checklistRes as any)?.items || []);
        setComments((commentsRes as any)?.comments || []);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedCard?.id]);

  const openAddColumnModal = () => setShowAddColumnModal(true);
  const closeAddColumnModal = () => setShowAddColumnModal(false);
  const openAddCardModal = (listId: string) => {
    setAddCardListId(listId);
    setShowAddCardModal(true);
  };
  const closeAddCardModal = () => setShowAddCardModal(false);

  const handleCreateColumn = async () => {
    if (!boardId) return;
    const name = newColumnName.trim();
    if (!name) return;
    try {
      const response = await apiPost(`/api/boards/${boardId}/lists`, {
        name,
        color: newColumnColor?.trim() || null,
      });
      const lists = (response as any)?.lists || [];
      const createdList =
        lists
          .filter((list: any) => list.name === name)
          .sort((a: any, b: any) => new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime())
          .pop() || lists[lists.length - 1];

      const cardTitles = newColumnCards
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      if (createdList?.id && cardTitles.length) {
        for (const [index, title] of cardTitles.entries()) {
          await apiPost(`/api/lists/${createdList.id}/cards`, {
            title,
            position: index,
          });
        }
      }

      setNewColumnName('');
      setNewColumnCards('');
      setNewColumnColor('#6366f1');
      closeAddColumnModal();
      await loadBoard();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCard = async () => {
    if (!addCardListId) return;
    const title = newCardTitle.trim();
    if (!title) return;
    try {
      await apiPost(`/api/lists/${addCardListId}/cards`, {
        title,
        description: newCardDescription.trim() || null,
      });
      setNewCardTitle('');
      setNewCardDescription('');
      closeAddCardModal();
      await loadBoard();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveCardTitle = async () => {
    if (!selectedCard?.id) return;
    const next = cardTitleDraft.trim();
    if (!next || next === selectedCard.title) return;
    try {
      await apiPatch(`/api/cards/${selectedCard.id}`, { title: next });
      setSelectedCard({ ...selectedCard, title: next });
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              lists: prev.lists.map((list) => ({
                ...list,
                cards: list.cards.map((card) => (card.id === selectedCard.id ? { ...card, title: next } : card)),
              })),
            }
          : prev
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveCardDescription = async () => {
    if (!selectedCard?.id) return;
    const next = cardDescriptionDraft.trim();
    if (next === (selectedCard.description || '')) return;
    try {
      await apiPatch(`/api/cards/${selectedCard.id}`, { description: next || null });
      setSelectedCard({ ...selectedCard, description: next || null });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddLink = async () => {
    if (!selectedCard?.id) return;
    const entityId = linkEntityId.trim();
    if (!entityId) return;
    try {
      const response = await apiPost(`/api/cards/${selectedCard.id}/links`, {
        entityType: linkEntityType,
        entityId,
      });
      setCardLinks((prev) => [...prev, (response as any)?.link].filter(Boolean));
      setLinkEntityId('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!selectedCard?.id) return;
    try {
      await apiDelete(`/api/cards/${selectedCard.id}/links/${linkId}`);
      setCardLinks((prev) => prev.filter((link) => link.id !== linkId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddChecklistItem = async () => {
    if (!selectedCard?.id) return;
    const body = newChecklistItem.trim();
    if (!body) return;
    try {
      const response = await apiPost(`/api/cards/${selectedCard.id}/checklist`, { body });
      const item = (response as any)?.item;
      if (item) setChecklistItems((prev) => [...prev, item]);
      setNewChecklistItem('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleChecklistItem = async (item: ChecklistItem) => {
    if (!selectedCard?.id) return;
    try {
      const response = await apiPatch(`/api/cards/${selectedCard.id}/checklist/${item.id}`, {
        isCompleted: !item.isCompleted,
      });
      const updated = (response as any)?.item;
      if (updated) {
        setChecklistItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveChecklistItem = async (itemId: string) => {
    if (!selectedCard?.id) return;
    try {
      await apiDelete(`/api/cards/${selectedCard.id}/checklist/${itemId}`);
      setChecklistItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async () => {
    if (!selectedCard?.id) return;
    const body = commentBody.trim();
    if (!body) return;
    try {
      const response = await apiPost(`/api/cards/${selectedCard.id}/comments`, { body });
      const comment = (response as any)?.comment;
      if (comment) setComments((prev) => [...prev, comment]);
      setCommentBody('');
    } catch (err) {
      console.error(err);
    }
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (!board) return;

    const sourceListId = source.droppableId;
    const destListId = destination.droppableId;
    if (sourceListId === destListId && source.index === destination.index) return;

    const nextLists = board.lists.map((list) => ({ ...list, cards: [...list.cards] }));
    const sourceList = nextLists.find((list) => list.id === sourceListId);
    const destList = nextLists.find((list) => list.id === destListId);
    if (!sourceList || !destList) return;

    const [moved] = sourceList.cards.splice(source.index, 1);
    if (!moved) return;
    const movedCard = { ...moved, listId: destListId };
    destList.cards.splice(destination.index, 0, movedCard);

    setBoard({ ...board, lists: nextLists });

    try {
      await apiPost(`/api/cards/${movedCard.id}/move`, {
        fromListId: sourceListId,
        toListId: destListId,
        toIndex: destination.index,
      });
    } catch (err) {
      console.error(err);
      await loadBoard();
    }
  };

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
        <DragDropContext onDragEnd={onDragEnd}>
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

                  <Droppable droppableId={list.id} type="card">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-3 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                      >
                        {list.cards.map((card, index) => (
                          <Draggable key={card.id} draggableId={card.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 group relative ${dragSnapshot.isDragging ? 'shadow-2xl scale-[1.01]' : ''}`}
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
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  <div className="p-3 border-t border-white/5">
                    <button
                      onClick={() => openAddCardModal(list.id)}
                      className="w-full py-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                    >
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
            <button
              onClick={openAddColumnModal}
              className="w-full h-14 bg-dark-800/20 hover:bg-dark-800/40 border-2 border-dashed border-white/5 hover:border-white/10 rounded-2xl text-gray-500 hover:text-gray-300 text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus text-xs"></i>
              Add column
            </button>
          </div>
          </div>
        </DragDropContext>
      </main>

      <div id="card-drawer" className={`fixed top-0 right-0 w-[55%] h-full bg-dark-900/95 backdrop-blur-xl border-l border-white/5 transform transition-transform duration-300 overflow-y-auto z-50 shadow-2xl ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <input
                type="text"
                value={cardTitleDraft || ''}
                onChange={(event) => setCardTitleDraft(event.target.value)}
                onBlur={handleSaveCardTitle}
                placeholder="Card name"
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
              {cardLinks.length === 0 ? (
                <div className="bg-dark-800/60 border border-white/5 rounded-xl p-4 text-sm text-gray-400">
                  No linked items yet.
                </div>
              ) : (
                cardLinks.map((link) => (
                  <div key={link.id} className="bg-dark-800/60 border border-white/5 rounded-xl p-4 hover:bg-dark-800 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 flex-shrink-0">
                          <i className="fa-solid fa-link"></i>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">{link.entityType}</div>
                          <div className="text-sm font-semibold text-white mb-1">{link.entityId}</div>
                          <div className="text-xs text-gray-400">{formatTimestamp(link.createdAt)}</div>
                        </div>
                      </div>
                      <button
                        className="w-8 h-8 bg-dark-700 hover:bg-dark-600 rounded-md flex items-center justify-center text-gray-400 hover:text-white transition-all"
                        onClick={() => handleRemoveLink(link.id)}
                      >
                        <i className="fa-solid fa-link-slash text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-dark-800/60 border border-white/5 rounded-xl p-4">
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={linkEntityType}
                  onChange={(event) => setLinkEntityType(event.target.value)}
                  className="bg-dark-700/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="lead">Lead</option>
                  <option value="candidate">Candidate</option>
                  <option value="opportunity">Opportunity</option>
                  <option value="table_row">Table row</option>
                </select>
                <input
                  type="text"
                  value={linkEntityId}
                  onChange={(event) => setLinkEntityId(event.target.value)}
                  placeholder="Entity ID"
                  className="col-span-2 bg-dark-700/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <button
                onClick={handleAddLink}
                className="mt-3 w-full py-2.5 bg-dark-700/60 hover:bg-dark-700 border border-white/5 rounded-lg text-sm font-medium text-gray-200 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                Link item
              </button>
            </div>
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
              value={cardDescriptionDraft || ''}
              onChange={(event) => setCardDescriptionDraft(event.target.value)}
              onBlur={handleSaveCardDescription}
            ></textarea>
          </div>

          <div id="checklist-section" className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-list-check text-xs"></i>
                Checklist
              </h3>
              <span className="text-xs text-gray-500">
                {checklistItems.filter((item) => item.isCompleted).length}/{checklistItems.length} completed
              </span>
            </div>

            <div className="space-y-2 mb-4">
              {checklistItems.length === 0 ? (
                <div className="p-3 bg-dark-800/60 border border-white/5 rounded-lg text-sm text-gray-400">
                  No checklist items yet.
                </div>
              ) : (
                checklistItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-dark-800/60 border border-white/5 rounded-lg">
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      onChange={() => handleToggleChecklistItem(item)}
                      className="w-4 h-4 rounded border-gray-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 bg-dark-700"
                    />
                    <span className={`text-sm ${item.isCompleted ? 'line-through text-gray-500' : 'text-gray-200'}`}>{item.body}</span>
                    <button
                      onClick={() => handleRemoveChecklistItem(item.id)}
                      className="ml-auto text-gray-500 hover:text-white transition-all"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newChecklistItem}
                onChange={(event) => setNewChecklistItem(event.target.value)}
                placeholder="Add checklist item"
                className="flex-1 bg-dark-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={handleAddChecklistItem}
                className="px-4 py-2 bg-dark-800/60 hover:bg-dark-800 border border-white/5 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                Add
              </button>
            </div>
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
                  <textarea
                    className="w-full bg-dark-800/60 border border-white/5 rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-dark-800 transition-all resize-none"
                    rows={3}
                    placeholder="Write a comment..."
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                  ></textarea>
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button onClick={handleAddComment} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-all">
                      Comment
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="p-4 bg-dark-800/60 border border-white/5 rounded-lg text-sm text-gray-400">
                  Activity will appear here as teammates comment or move cards.
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-3">
                    <img
                      src={comment.author?.avatarUrl || 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg'}
                      className="w-9 h-9 rounded-full border border-white/10 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="bg-dark-800/60 border border-white/5 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-white">{comment.author?.fullName || 'Teammate'}</span>
                          <span className="text-xs text-gray-500">{formatTimestamp(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">{comment.body}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div id="add-column-modal" className={`fixed inset-0 z-50 ${showAddColumnModal ? '' : 'hidden'}`}>
        <div className="absolute inset-0 bg-black/60" onClick={closeAddColumnModal}></div>
        <div className="relative z-10 max-w-xl mx-auto mt-20">
          <div className="bg-dark-900/95 border border-white/10 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">Add Column</h2>
              <button onClick={closeAddColumnModal} className="text-gray-400 hover:text-white transition-all">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Column name</label>
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(event) => setNewColumnName(event.target.value)}
                  placeholder="e.g. Review"
                  className="w-full bg-dark-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Column color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newColumnColor}
                    onChange={(event) => setNewColumnColor(event.target.value)}
                    className="h-10 w-14 rounded-lg bg-transparent border border-white/10"
                  />
                  <input
                    type="text"
                    value={newColumnColor}
                    onChange={(event) => setNewColumnColor(event.target.value)}
                    placeholder="#6366f1"
                    className="flex-1 bg-dark-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cards (one per line)</label>
                <textarea
                  value={newColumnCards}
                  onChange={(event) => setNewColumnCards(event.target.value)}
                  rows={6}
                  placeholder="Card title 1&#10;Card title 2&#10;Card title 3"
                  className="w-full bg-dark-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 resize-none"
                ></textarea>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <button onClick={closeAddColumnModal} className="px-5 py-2.5 bg-dark-800/60 hover:bg-dark-800 text-white rounded-xl text-sm font-medium transition-all">
                Cancel
              </button>
              <button onClick={handleCreateColumn} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all">
                Create Column
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="add-card-modal" className={`fixed inset-0 z-50 ${showAddCardModal ? '' : 'hidden'}`}>
        <div className="absolute inset-0 bg-black/60" onClick={closeAddCardModal}></div>
        <div className="relative z-10 max-w-xl mx-auto mt-20">
          <div className="bg-dark-900/95 border border-white/10 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">Add Card</h2>
              <button onClick={closeAddCardModal} className="text-gray-400 hover:text-white transition-all">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Card title</label>
                <input
                  type="text"
                  value={newCardTitle}
                  onChange={(event) => setNewCardTitle(event.target.value)}
                  placeholder="e.g. Review outreach plan"
                  className="w-full bg-dark-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={newCardDescription}
                  onChange={(event) => setNewCardDescription(event.target.value)}
                  rows={4}
                  placeholder="Optional details for this card"
                  className="w-full bg-dark-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 resize-none"
                ></textarea>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <button onClick={closeAddCardModal} className="px-5 py-2.5 bg-dark-800/60 hover:bg-dark-800 text-white rounded-xl text-sm font-medium transition-all">
                Cancel
              </button>
              <button onClick={handleCreateCard} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all">
                Create Card
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

