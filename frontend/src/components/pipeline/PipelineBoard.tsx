import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import CandidateCard, { CandidateItem } from './CandidateCard';
import NotesDrawer from './NotesDrawer';
import { supabase } from '../../lib/supabase';

interface Stage {
  id: string;
  title: string;
  position?: number;
  color?: string;
}

interface PipelineBoardProps {
  jobId: string;
  pipelineIdOverride?: string | null;
  refreshKey?: number;
  showHeader?: boolean;
}

export default function PipelineBoard({ jobId, pipelineIdOverride = null, refreshKey = 0, showHeader = true }: PipelineBoardProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [candidatesByStage, setCandidatesByStage] = useState<Record<string, CandidateItem[]>>({});
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem | null>(null);
  const [selectedStageTitle, setSelectedStageTitle] = useState<string>('');
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStageMenu, setShowStageMenu] = useState<string | null>(null);
  const [zapierEnabled, setZapierEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('zapier_notify_enabled') !== '0'; } catch { return true; }
  });

  const baseUrl = useMemo(() => (import.meta as any).env.VITE_BACKEND_URL, []);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        // Pipeline for job
        const pRes = await fetch(`${baseUrl}/api/pipelines?jobId=${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        });
        const p = await pRes.json();
        const list = Array.isArray(p) ? p : (p?.pipeline ? [p.pipeline] : (Array.isArray(p?.pipelines) ? p.pipelines : []));
        const active = pipelineIdOverride
          ? (list.find((it: any) => String(it.id) === String(pipelineIdOverride)) || list[0])
          : list[0];
        if (!active) { setStages([]); setCandidatesByStage({}); return; }
        setPipelineId(String(active.id));
        // Stages + candidates
        const sRes = await fetch(`${baseUrl}/api/pipelines/${active.id}/stages?jobId=${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        });
        const sj = await sRes.json();
        const nextStages: Stage[] = Array.isArray(sj?.stages) ? sj.stages : (sj?.pipeline?.stages || []);
        setStages(nextStages);
        setCandidatesByStage(sj?.candidates || {});
      } finally {
        setLoading(false);
      }
    };
    if (jobId) fetchAll();
  }, [jobId, baseUrl, pipelineIdOverride, refreshKey]);

  useEffect(() => {
    if (!jobId) return;
    const ch = supabase
      .channel(`pipeline-realtime-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_jobs', filter: `job_id=eq.${jobId}` }, async () => {
        // simple refresh
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token || !pipelineId) return;
          const sRes = await fetch(`${baseUrl}/api/pipelines/${pipelineId}/stages?jobId=${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include'
          });
          const sj = await sRes.json();
          setStages(Array.isArray(sj?.stages) ? sj.stages : (sj?.pipeline?.stages || []));
          setCandidatesByStage(sj?.candidates || {});
        } catch {}
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_stages' }, async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token || !pipelineId) return;
          const sRes = await fetch(`${baseUrl}/api/pipelines/${pipelineId}/stages?jobId=${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include'
          });
          const sj = await sRes.json();
          setStages(Array.isArray(sj?.stages) ? sj.stages : (sj?.pipeline?.stages || []));
          setCandidatesByStage(sj?.candidates || {});
        } catch {}
      })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [jobId, pipelineId, baseUrl]);

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source, destination, type } = result;

    if (type === 'stage') {
      const reordered = Array.from(stages);
      const [rm] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, rm);
      const mapped = reordered.map((s, i) => ({ ...s, position: i }));
      setStages(mapped);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token || !pipelineId) return;
        await fetch(`${baseUrl}/api/pipelines/${pipelineId}/stages/reorder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          credentials: 'include',
          body: JSON.stringify({ stages: mapped.map(s => ({ id: s.id, position: s.position })) })
        });
      } catch {}
      return;
    }

    // candidate move
    const src = source.droppableId;
    const dst = destination.droppableId;
    const sourceArr = Array.from(candidatesByStage[src] || []);
    const destArr = Array.from(candidatesByStage[dst] || []);
    const [moved] = sourceArr.splice(source.index, 1);
    if (!moved) return;
    destArr.splice(destination.index, 0, moved);
    setCandidatesByStage({ ...candidatesByStage, [src]: sourceArr, [dst]: destArr });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token || !pipelineId) return;
      const stageTitle = stages.find(s => String(s.id) === String(dst))?.title || '';
      await fetch(`${baseUrl}/api/pipelines/${pipelineId}/candidates/${moved.candidate_id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ jobId, stageId: dst, stageTitle, zapier: !!zapierEnabled })
      });
    } catch {}
  };

  if (loading) return <div className="p-6 text-gray-500">Loading pipeline…</div>;

  return (
    <div className="w-full">
      {showHeader && (
        <div className="px-6 pt-4 pb-0 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Job Pipeline</h1>
          <div className="flex items-center gap-2">
            <label className="mr-2 flex items-center gap-2 text-sm text-gray-600">
              <span>Zapier</span>
              <input type="checkbox" checked={zapierEnabled} onChange={(e)=>{ setZapierEnabled(e.target.checked); try { localStorage.setItem('zapier_notify_enabled', e.target.checked ? '1' : '0'); } catch {} }} />
            </label>
            <button
              className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200"
              onClick={async () => {
                const title = prompt('New stage name');
                if (!title || !pipelineId) return;
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const token = session?.access_token;
                  const position = stages.length;
                  const res = await fetch(`${baseUrl}/api/pipelines/${pipelineId}/stages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    credentials: 'include',
                    body: JSON.stringify({ title, color: 'bg-blue-100 text-blue-800', position })
                  });
                  if (!res.ok) throw new Error('Failed');
                  const created = await res.json();
                  setStages(prev => [...prev, created]);
                  setCandidatesByStage(prev => ({ ...prev, [created.id]: [] }));
                } catch {}
              }}
            >
              <i className="fa-solid fa-plus mr-2" /> New Stage
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-6 overflow-x-auto p-6">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="stages" direction="horizontal" type="stage">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-6">
              {stages.map((stage, idx) => (
                <Draggable key={String(stage.id)} draggableId={String(stage.id)} index={idx}>
                  {(providedStage) => (
                    <div ref={providedStage.innerRef} {...providedStage.draggableProps} className="w-[320px] flex-shrink-0 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h2 className="font-semibold">{stage.title}</h2>
                          <span className="text-sm font-medium bg-white text-gray-500 px-2 py-0.5 rounded-full border">{(candidatesByStage[stage.id] || []).length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() => setShowStageMenu(showStageMenu === String(stage.id) ? null : String(stage.id))}
                            title="Stage options"
                          >
                            <i className="fa-solid fa-ellipsis-vertical" />
                          </button>
                          <div className="text-gray-400 cursor-grab" {...providedStage.dragHandleProps}>
                            <i className="fa-solid fa-grip-vertical" />
                          </div>
                          {showStageMenu === String(stage.id) && (
                            <div className="relative">
                              <div className="absolute right-0 top-6 w-40 bg-white border rounded-lg shadow z-10">
                                <button
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                  onClick={async () => {
                                    setShowStageMenu(null);
                                    const next = prompt('Rename stage', stage.title);
                                    if (!next || !pipelineId) return;
                                    try {
                                      const { data: { session } } = await supabase.auth.getSession();
                                      const token = session?.access_token;
                                      const res = await fetch(`${baseUrl}/api/pipelines/${pipelineId}/stages/${stage.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                        credentials: 'include',
                                        body: JSON.stringify({ title: next })
                                      });
                                      if (!res.ok) throw new Error('Failed');
                                      const updated = await res.json();
                                      setStages(prev => prev.map(s => (String(s.id) === String(stage.id) ? updated : s)));
                                    } catch {}
                                  }}
                                >
                                  Rename
                                </button>
                                <button
                                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                  onClick={async () => {
                                    setShowStageMenu(null);
                                    if (!pipelineId) return;
                                    const ok = confirm('Delete this stage?');
                                    if (!ok) return;
                                    try {
                                      const { data: { session } } = await supabase.auth.getSession();
                                      const token = session?.access_token;
                                      const res = await fetch(`${baseUrl}/api/pipelines/${pipelineId}/stages/${stage.id}`, {
                                        method: 'DELETE',
                                        headers: { Authorization: `Bearer ${token}` },
                                        credentials: 'include'
                                      });
                                      if (!res.ok) throw new Error('Failed');
                                      setStages(prev => prev.filter(s => String(s.id) !== String(stage.id)));
                                      setCandidatesByStage(prev => {
                                        const copy = { ...prev } as Record<string, CandidateItem[]>;
                                        delete copy[String(stage.id)];
                                        return copy;
                                      });
                                    } catch {}
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <Droppable droppableId={String(stage.id)}>
                        {(providedDrop) => (
                          <div ref={providedDrop.innerRef} {...providedDrop.droppableProps} className="kanban-column-content flex-grow space-y-4 overflow-y-auto pr-2">
                            {(candidatesByStage[stage.id] || []).map((c, i) => (
                              <Draggable key={String(c.id)} draggableId={String(c.id)} index={i}>
                                {(providedCard) => (
                                  <div ref={providedCard.innerRef} {...providedCard.draggableProps} {...providedCard.dragHandleProps}>
                                    <CandidateCard
                                      candidate={c}
                                      onClick={(cand) => { setSelectedCandidate(cand); setSelectedStageTitle(stage.title); }}
                                      rightAction={<i className="fa-solid fa-pencil" />}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {providedDrop.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <NotesDrawer
        open={Boolean(selectedCandidate)}
        onClose={() => setSelectedCandidate(null)}
        candidateId={selectedCandidate?.candidate_id || null}
        candidateName={selectedCandidate?.name}
        stageTitle={selectedStageTitle}
      />
    </div>
    </div>
  );
}


