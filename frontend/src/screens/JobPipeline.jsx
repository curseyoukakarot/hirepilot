import React, { useEffect, useMemo, useState } from 'react';
import {
  FaPlus, FaEllipsisV, FaUserPlus, FaSearch, FaTimes,
  FaTrash, FaEdit, FaCheck, FaGripVertical, FaKeyboard
} from 'react-icons/fa';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const defaultStages = [
  { title: 'Sourced',   color: 'bg-blue-100 text-blue-800' },
  { title: 'Contacted', color: 'bg-yellow-100 text-yellow-800' },
  { title: 'Interviewed', color: 'bg-purple-100 text-purple-800' },
  { title: 'Offered',   color: 'bg-green-100 text-green-800' },
  { title: 'Hired',     color: 'bg-indigo-100 text-indigo-800' },
];

const departments = ['Engineering', 'Sales', 'Product', 'Marketing', 'HR', 'Finance'];
const getAvatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`;

async function getSessionToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    toast.error('Not authenticated');
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export default function JobPipeline() {
  const { id: jobId } = useParams();
  const navigate = useNavigate();

  // Selection / UI
  const [selectedJob, setSelectedJob] = useState(jobId || 'all');
  const [selectedPipeline, setSelectedPipeline] = useState('all');
  const [selectedStage, setSelectedStage] = useState(null);
  const [showStageMenu, setShowStageMenu] = useState(null);
  const [candidateToRemove, setCandidateToRemove] = useState(null);
  const [stageToDelete, setStageToDelete] = useState(null);
  const [selectedCandidates, setSelectedCandidates] = useState(new Set());

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [showEditStageModal, setShowEditStageModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showNewStageModal, setShowNewStageModal] = useState(false);
  const [showDeleteStageConfirm, setShowDeleteStageConfirm] = useState(false);
  const [showOverwritePipelineConfirm, setShowOverwritePipelineConfirm] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineDepartment, setNewPipelineDepartment] = useState('');
  const [editingStage, setEditingStage] = useState(null);
  const [stageColor, setStageColor] = useState('bg-blue-100 text-blue-800');
  const [stageTitle, setStageTitle] = useState('');
  const [newStageTitle, setNewStageTitle] = useState('');
  const [newStageColor, setNewStageColor] = useState('bg-blue-100 text-blue-800');
  const [pendingPipelineData, setPendingPipelineData] = useState(null);

  // Data
  const [stages, setStages] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [pipelineExists, setPipelineExists] = useState(true);
  const [candidates, setCandidates] = useState({});
  const [availableCandidates, setAvailableCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  // Loaders
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Derived pipeline name
  const pipelineName = useMemo(() => {
    const job = jobs?.find(j => j.id === selectedJob);
    if (!selectedJob || !pipelines?.length) return 'All Pipelines';
    if (!job) return 'All Pipelines';
    if (!job.pipeline_id) return job.title || 'All Pipelines';
    const pipeline = pipelines.find(p => String(p.id) === String(job.pipeline_id));
    if (pipeline?.name) return pipeline.name;
    if (job.title) return job.title;
    return 'All Pipelines';
  }, [selectedJob, jobs, pipelines]);

  useEffect(() => { if (jobId) setSelectedJob(jobId); }, [jobId]);

  // Jobs list (owned by current user)
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('job_requisitions')
          .select('*')
          .eq('user_id', user.id);
        if (error) setJobs([]);
        else setJobs(data || []);
      } catch {
        setJobs([]);
      }
    })();
  }, []);

  // Load pipeline + stages + candidates for selected job
  const fetchStagesAndCandidates = async () => {
    try {
      setLoading(true);
      if (!selectedJob || selectedJob === 'all') {
        setPipelineExists(false);
        setStages([]); setCandidates({});
        return;
      }
      const token = await getSessionToken();
      const base = import.meta.env.VITE_BACKEND_URL;
      const cacheBust = Date.now();

      // Which pipeline is linked to this job?
      let pipelineRes = await fetch(`${base}/api/pipelines?jobId=${selectedJob}&_=${cacheBust}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (pipelineRes.status === 304) {
        pipelineRes = await fetch(`${base}/api/pipelines?jobId=${selectedJob}&_=${Date.now()}`, {
          credentials: 'include',
          cache: 'reload',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
      if (!pipelineRes.ok) throw new Error('Failed to fetch pipelines');
      const pipelineJson = await pipelineRes.json();
      const pipelineData = Array.isArray(pipelineJson)
        ? pipelineJson
        : (pipelineJson && pipelineJson.pipeline ? [pipelineJson.pipeline] : []);
      setPipelines(pipelineData);

      if (!pipelineData || pipelineData.length === 0) {
        setPipelineExists(false);
        setStages([]); setCandidates({});
        return;
      }

      const active = pipelineData[0];
      setSelectedPipeline(active.id);

      // Load stages + candidates grouped by stage
      let stagesRes = await fetch(`${base}/api/pipelines/${active.id}/stages?jobId=${selectedJob}&_=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (stagesRes.status === 304) {
        stagesRes = await fetch(`${base}/api/pipelines/${active.id}/stages?jobId=${selectedJob}&_=${Date.now()}`, {
          credentials: 'include',
          cache: 'reload',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
      if (!stagesRes.ok) throw new Error('Failed to fetch stages');
      const stageJson = await stagesRes.json();
      const nextStages = Array.isArray(stageJson?.stages) ? stageJson.stages : (stageJson?.pipeline?.stages || []);
      const nextCandidates = stageJson?.candidates || {};
      setStages(nextStages);
      setCandidates(nextCandidates);
      setPipelineExists(true);
      setError(null);
    } catch (err) {
      console.error('Error loading pipeline stages/candidates:', err);
      setError('Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStagesAndCandidates(); }, [selectedJob]);

  // Realtime refresh on relevant tables
  useEffect(() => {
    if (!selectedJob || selectedJob === 'all') return;
    const ch = supabase
      .channel(`pipeline-realtime-${selectedJob}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'candidate_jobs', filter: `job_id=eq.${selectedJob}` },
        fetchStagesAndCandidates
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pipeline_stages' },
        fetchStagesAndCandidates
      )
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [selectedJob]);

  // DnD handler (stage reorder + candidate move)
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, type } = result;

    // Stage reorder
    if (type === 'stage') {
      const newStages = Array.from(stages);
      const [removed] = newStages.splice(source.index, 1);
      newStages.splice(destination.index, 0, removed);
      const updatedStages = newStages.map((s, i) => ({ ...s, position: i }));
      setStages(updatedStages);

      try {
        const token = await getSessionToken();
        const base = import.meta.env.VITE_BACKEND_URL;
        await fetch(`${base}/api/pipelines/${selectedPipeline}/stages/reorder`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stages: updatedStages.map(s => ({ id: s.id, position: s.position })),
          }),
        });
        toast.success('Pipeline stages reordered');
      } catch (err) {
        console.error('Stage reorder error:', err);
        toast.error('Failed to reorder stages');
      }
      return;
    }

    // Candidate move
    const sourceStage = source.droppableId;
    const destStage = destination.droppableId;
    const sourceCandidates = Array.from(candidates[sourceStage] || []);
    const destCandidates = Array.from(candidates[destStage] || []);
    const [moved] = sourceCandidates.splice(source.index, 1);
    if (!moved) return;

    try {
      const token = await getSessionToken();
      const base = import.meta.env.VITE_BACKEND_URL;
      const stageTitle = stages.find(s => String(s.id) === String(destStage))?.title || '';
      const res = await fetch(`${base}/api/pipelines/${selectedPipeline}/candidates/${moved.candidate_id}/move`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: selectedJob, stageId: destStage, stageTitle }),
      });
      if (!res.ok) throw new Error('Move failed');

      destCandidates.splice(destination.index, 0, moved);
      setCandidates({
        ...candidates,
        [sourceStage]: sourceCandidates,
        [destStage]: destCandidates,
      });
    } catch (err) {
      console.error('Candidate move error:', err);
      toast.error('Failed to update candidate stage');
    }
  };

  // Candidate add/remove (UX only remove from view)
  const handleAddCandidate = (stageId) => {
    setSelectedStage(stageId);
    setShowModal(true);
  };
  const handleRemoveCandidate = (stageId, candidateId) => {
    setCandidateToRemove({ stageId, candidateId });
    setShowConfirmDialog(true);
  };
  const confirmRemoveCandidate = () => {
    if (candidateToRemove) {
      setCandidates((prev) => ({
        ...prev,
        [candidateToRemove.stageId]: (prev[candidateToRemove.stageId] || []).filter(
          (c) => c.id !== candidateToRemove.candidateId
        )
      }));
      toast.success('Candidate removed from view');
    }
    setShowConfirmDialog(false);
    setCandidateToRemove(null);
  };

  // Available candidates in modal (exclude already in job)
  useEffect(() => {
    (async () => {
      if (!showModal || !selectedJob || selectedJob === 'all') return;
      setCandidatesLoading(true);
      try {
        const { data: allCandidates, error } = await supabase
          .from('candidates')
          .select('id, first_name, last_name, email, avatar_url');
        if (error) throw error;

        const { data: jobCandidates, error: jcError } = await supabase
          .from('candidate_jobs')
          .select('candidate_id')
          .eq('job_id', selectedJob);
        if (jcError) throw jcError;

        const usedIds = new Set((jobCandidates || []).map((c) => c.candidate_id));
        setAvailableCandidates((allCandidates || []).filter((c) => !usedIds.has(c.id)));
      } catch {
        setAvailableCandidates([]);
      } finally {
        setCandidatesLoading(false);
      }
    })();
  }, [showModal, selectedJob]);

  const handleSelectCandidate = async (candidate) => {
    if (selectedStage && selectedJob) {
      const { error } = await supabase.from('candidate_jobs').insert({
        candidate_id: candidate.id,
        job_id: selectedJob,
        stage_id: selectedStage
      });
      if (!error) {
        setCandidates((prev) => ({
          ...prev,
          [selectedStage]: [
            ...(prev[selectedStage] || []),
            {
              id: candidate.id,
              candidate_id: candidate.id,
              name: `${candidate.first_name} ${candidate.last_name}`,
              email: candidate.email,
              avatar_url: candidate.avatar_url
            }
          ]
        }));
        toast.success('Candidate added');
      } else {
        toast.error('Failed to add candidate');
      }
    }
    setShowModal(false);
    setSelectedStage(null);
    setSearchQuery('');
  };

  // Stage CRUD
  const handleEditStage = (stage) => {
    setEditingStage(stage);
    setStageColor(stage.color || 'bg-blue-100 text-blue-800');
    setStageTitle(stage.title || '');
    setShowEditStageModal(true);
    setShowStageMenu(null);
  };

  const handleSaveStageEdit = async () => {
    if (!editingStage) return;
    try {
      const token = await getSessionToken();
      const base = import.meta.env.VITE_BACKEND_URL;
      const res = await fetch(`${base}/api/pipelines/${selectedPipeline}/stages/${editingStage.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: stageTitle, color: stageColor })
      });
      if (!res.ok) throw new Error('Failed to update stage');
      const updated = await res.json();
      setStages((prev) => prev.map((s) => (s.id === editingStage.id ? updated : s)));
      setShowEditStageModal(false);
      setEditingStage(null);
      toast.success('Stage updated');
    } catch (err) {
      console.error('Stage update error:', err);
      toast.error('Failed to update stage');
    }
  };

  const handleCreateStage = async () => {
    if (selectedJob === 'all' || !selectedPipeline) {
      toast.error('Select a job first');
      return;
    }
    try {
      const token = await getSessionToken();
      const base = import.meta.env.VITE_BACKEND_URL;
      const position = stages.length;
      const res = await fetch(`${base}/api/pipelines/${selectedPipeline}/stages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newStageTitle, color: newStageColor, position })
      });
      if (!res.ok) throw new Error('Failed to create stage');
      const newStage = await res.json();
      setStages((prev) => [...prev, newStage]);
      setCandidates((prev) => ({ ...prev, [newStage.id]: [] }));
      setShowNewStageModal(false);
      setNewStageTitle('');
      setNewStageColor('bg-blue-100 text-blue-800');
      toast.success('New stage created');
    } catch (err) {
      console.error('Stage create error:', err);
      toast.error('Failed to create stage');
    }
  };

  const handleRemoveStage = (stageId) => {
    setStageToDelete(stageId);
    setShowDeleteStageConfirm(true);
    setShowStageMenu(null);
  };

  const confirmDeleteStage = async () => {
    if (!stageToDelete) return;
    try {
      const token = await getSessionToken();
      const base = import.meta.env.VITE_BACKEND_URL;
      const res = await fetch(`${base}/api/pipelines/${selectedPipeline}/stages/${stageToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete stage');

      setStages((prev) => prev.filter((s) => s.id !== stageToDelete));
      setCandidates((prev) => {
        const copy = { ...prev };
        delete copy[stageToDelete];
        return copy;
      });
      toast.success('Stage deleted');
    } catch (err) {
      console.error('Stage delete error:', err);
      toast.error('Failed to delete stage');
    } finally {
      setShowDeleteStageConfirm(false);
      setStageToDelete(null);
    }
  };

  // Pipeline create (with overwrite guard)
  const actuallyCreatePipeline = async (name, department, existingToken) => {
    const token = existingToken || await getSessionToken();
    const base = import.meta.env.VITE_BACKEND_URL;
    const payload = {
      name,
      department,
      job_id: selectedJob,
      stages: defaultStages.map((s, i) => ({
        name: s.title,
        color: s.color,
        position: i,
        icon: '',
      })),
    };
    const res = await fetch(`${base}/api/pipelines`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create pipeline');
    const created = await res.json();
    // Optimistically update UI if backend returned the pipeline with stages
    if (created?.pipeline) {
      const p = created.pipeline;
      setPipelines([ { id: p.id, name: p.name, department: p.department } ]);
      setSelectedPipeline(p.id);
      setStages(p.stages || []);
      setCandidates({});
      setPipelineExists(true);
    }

    await fetchStagesAndCandidates();
    setShowNewPipelineModal(false);
    setNewPipelineName('');
    setNewPipelineDepartment('');
    toast.success('Pipeline created');
  };

  const handleCreatePipeline = async () => {
    try {
      if (!selectedJob || selectedJob === 'all') {
        toast.error('Please select a job first');
        return;
      }
      const token = await getSessionToken();
      const base = import.meta.env.VITE_BACKEND_URL;

      // If a pipeline exists, confirm overwrite
      const existingRes = await fetch(`${base}/api/pipelines?jobId=${selectedJob}`, {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const existing = existingRes.ok ? await existingRes.json() : [];
      if (existing.length) {
        setPendingPipelineData({ name: newPipelineName, department: newPipelineDepartment });
        setShowOverwritePipelineConfirm(true);
        return;
      }
      await actuallyCreatePipeline(newPipelineName, newPipelineDepartment, token);
    } catch (err) {
      console.error('Pipeline create error:', err);
      toast.error('Failed to create pipeline');
    }
  };

  const handleOverwritePipelineConfirm = async () => {
    setShowOverwritePipelineConfirm(false);
    if (pendingPipelineData) {
      await actuallyCreatePipeline(pendingPipelineData.name, pendingPipelineData.department);
      setPendingPipelineData(null);
    }
  };
  const handleOverwritePipelineCancel = () => {
    setShowOverwritePipelineConfirm(false);
    setPendingPipelineData(null);
  };

  // Bulk select/remove helpers
  const handleBulkSelect = (id) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Filters
  const filteredPipelines = pipelines.filter((p) =>
    (p.name || '').toLowerCase().includes(pipelineSearch.toLowerCase()) ||
    (p.department || '').toLowerCase().includes(pipelineSearch.toLowerCase())
  );
  const filteredCandidates = availableCandidates.filter((c) =>
    (`${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading pipeline...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-semibold text-gray-900">Job Pipeline</h1>

                {/* Pipeline Selector (read-only label for now; filter still supported) */}
                <select
                  className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedPipeline}
                  onChange={(e) => setSelectedPipeline(e.target.value)}
                >
                  <option value="all">All Pipelines</option>
                  {filteredPipelines.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </option>
                  ))}
                </select>

                {/* Job Selector */}
                <select
                  className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedJob}
                  onChange={(e) => {
                    const newJob = e.target.value;
                    setSelectedJob(newJob);
                    if (newJob !== 'all') navigate(`/job/${newJob}/pipeline`);
                  }}
                >
                  <option value="all">All Jobs</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>

                <span className="text-sm text-gray-500 ml-2 truncate max-w-xs">
                  {pipelineName}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200"
                  onClick={() => setShowNewPipelineModal(true)}
                >
                  <FaPlus /> New Pipeline
                </button>
                <button
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200"
                  onClick={() => setShowNewStageModal(true)}
                >
                  <FaPlus /> New Stage
                </button>
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                  onClick={() => handleAddCandidate(stages[0]?.id || 'sourced')}
                >
                  <FaUserPlus /> Add Candidate
                </button>
                <button
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200"
                  onClick={() => setShowKeyboardShortcuts(true)}
                  title="Keyboard Shortcuts"
                >
                  <FaKeyboard />
                </button>
              </div>

              {selectedCandidates.size > 0 && (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">{selectedCandidates.size} selected</span>
                  <button
                    onClick={() => {
                      // UI-only bulk remove from view (does not delete DB)
                      setCandidates((prev) => {
                        const copy = { ...prev };
                        Object.keys(copy).forEach((stageId) => {
                          copy[stageId] = (copy[stageId] || []).filter((c) => !selectedCandidates.has(c.id));
                        });
                        return copy;
                      });
                      setSelectedCandidates(new Set());
                      toast.success('Candidates removed from view');
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700"
                  >
                    <FaTrash /> Delete Selected
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Main */}
          <main className="max-w-7xl mx-auto px-6 py-8">
            {!pipelineExists ? (
              <div className="min-h-[300px] flex flex-col items-center justify-center">
                <div className="text-red-600 text-lg font-semibold mb-4">
                  This job has no pipeline! Click <b>New Pipeline</b> to create one.
                </div>
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                  onClick={() => setShowNewPipelineModal(true)}
                >
                  <FaPlus /> New Pipeline
                </button>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="stages" direction="horizontal" type="stage">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex gap-4 overflow-x-auto pb-4"
                    >
                      {stages.map((stage, index) => (
                        <Draggable key={String(stage.id)} draggableId={String(stage.id)} index={index}>
                          {(providedDraggable) => (
                            <div
                              ref={providedDraggable.innerRef}
                              {...providedDraggable.draggableProps}
                              className="w-80 flex-shrink-0"
                            >
                              <div className="bg-white rounded-lg shadow-sm border">
                                {/* Stage Header */}
                                <div className="p-4 border-b flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <div {...providedDraggable.dragHandleProps} className="cursor-grab">
                                      <FaGripVertical className="text-gray-400" />
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${stage.color}`}>
                                      {stage.title}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      {(candidates[stage.id] || []).length}
                                    </span>
                                  </div>
                                  <div className="relative">
                                    <button
                                      className="text-gray-400 hover:text-gray-600"
                                      onClick={() =>
                                        setShowStageMenu(showStageMenu === stage.id ? null : stage.id)
                                      }
                                    >
                                      <FaEllipsisV />
                                    </button>
                                    {showStageMenu === stage.id && (
                                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-10">
                                        <button
                                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                          onClick={() => handleRemoveStage(stage.id)}
                                        >
                                          <FaTrash className="text-red-500" /> Delete Stage
                                        </button>
                                        <button
                                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                          onClick={() => handleEditStage(stage)}
                                        >
                                          <FaEdit /> Edit Stage
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Stage Content */}
                                <Droppable droppableId={String(stage.id)}>
                                  {(providedDrop) => (
                                    <div
                                      ref={providedDrop.innerRef}
                                      {...providedDrop.droppableProps}
                                      className="h-full overflow-y-auto px-2 min-h-[200px]"
                                    >
                                      {(candidates[stage.id] || []).map((candidate, idx) => (
                                        <Draggable key={String(candidate.id)} draggableId={String(candidate.id)} index={idx}>
                                          {(providedCandidate) => (
                                            <div
                                              ref={providedCandidate.innerRef}
                                              {...providedCandidate.draggableProps}
                                              className="p-3 mb-2 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow"
                                            >
                                              <div className="flex items-center gap-3">
                                                <span
                                                  {...providedCandidate.dragHandleProps}
                                                  className="cursor-grab text-gray-400 pr-1"
                                                >
                                                  <FaGripVertical />
                                                </span>

                                                {/* Bulk select checkbox */}
                                                <input
                                                  type="checkbox"
                                                  checked={selectedCandidates.has(candidate.id)}
                                                  onChange={() => handleBulkSelect(candidate.id)}
                                                  className="h-4 w-4"
                                                />

                                                <img
                                                  src={candidate.avatar_url || getAvatarUrl(candidate.name)}
                                                  alt={candidate.name}
                                                  className="w-10 h-10 rounded-full"
                                                  onError={(e) => {
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.src = getAvatarUrl(candidate.name || 'User');
                                                  }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-medium text-gray-900 truncate">
                                                    {candidate.name}
                                                  </p>
                                                  <p className="text-sm text-gray-500 truncate">
                                                    {candidate.email}
                                                  </p>
                                                </div>
                                                <button
                                                  onClick={() => handleRemoveCandidate(stage.id, candidate.id)}
                                                  className="text-red-600 hover:text-red-700"
                                                  title="Remove from this view"
                                                >
                                                  <FaTimes />
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}
                                      {providedDrop.placeholder}
                                      <button
                                        onClick={() => handleAddCandidate(stage.id)}
                                        className="w-full p-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg flex items-center justify-center gap-2"
                                      >
                                        <FaPlus className="text-xs" /> Add Candidate
                                      </button>
                                    </div>
                                  )}
                                </Droppable>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </main>

          {/* === Modals === */}

          {/* Quick Search Modal (Add Candidate) */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-md mx-4">
                <div className="p-4 border-b flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Add Candidate</h2>
                  <button
                    onClick={() => { setShowModal(false); setSelectedStage(null); setSearchQuery(''); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes />
                  </button>
                </div>
                <div className="p-4">
                  <div className="relative mb-4">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search candidates..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {candidatesLoading ? (
                      <div className="text-center text-gray-500 py-4">Loading candidates...</div>
                    ) : filteredCandidates.length > 0 ? (
                      filteredCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          onClick={() => handleSelectCandidate(candidate)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg mb-2 text-left"
                        >
                          <img
                            src={candidate.avatar_url || getAvatarUrl(`${candidate.first_name} ${candidate.last_name}`)}
                            alt={`${candidate.first_name} ${candidate.last_name}`}
                            className="w-10 h-10 rounded-full"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = getAvatarUrl(`${candidate.first_name} ${candidate.last_name}`);
                            }}
                          />
                          <div className="overflow-hidden">
                            <div className="font-medium text-gray-900 truncate">
                              {candidate.first_name} {candidate.last_name}
                            </div>
                            <div className="text-sm text-gray-500 truncate">{candidate.email}</div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-4">No candidates found</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Pipeline Modal */}
          {showNewPipelineModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-md mx-4">
                <div className="p-4 border-b flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Create New Pipeline</h2>
                  <button
                    onClick={() => { setShowNewPipelineModal(false); setNewPipelineName(''); setNewPipelineDepartment(''); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes />
                  </button>
                </div>
                <div className="p-4">
                  {selectedJob !== 'all' ? (
                    <div className="mb-4 text-sm text-gray-700">
                      <b>Selected Job:</b> {jobs.find((j) => j.id === selectedJob)?.title || selectedJob}
                    </div>
                  ) : (
                    <div className="mb-4 text-sm text-red-600">
                      <b>No job selected!</b> Please select a job first.
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline Name</label>
                      <input
                        type="text"
                        placeholder="e.g., Engineering Pipeline"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={newPipelineName}
                        onChange={(e) => setNewPipelineName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                      <select
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={newPipelineDepartment}
                        onChange={(e) => setNewPipelineDepartment(e.target.value)}
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setShowNewPipelineModal(false); setNewPipelineName(''); setNewPipelineDepartment(''); }}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreatePipeline}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <FaCheck /> Create Pipeline
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Stage Modal */}
          {showEditStageModal && editingStage && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-md mx-4">
                <div className="p-4 border-b flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Edit Stage</h2>
                  <button
                    onClick={() => { setShowEditStageModal(false); setEditingStage(null); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stage Name</label>
                    <input
                      type="text"
                      value={stageTitle}
                      onChange={(e) => setStageTitle(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stage Color</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        'bg-blue-100 text-blue-800',
                        'bg-yellow-100 text-yellow-800',
                        'bg-purple-100 text-purple-800',
                        'bg-green-100 text-green-800',
                        'bg-indigo-100 text-indigo-800',
                        'bg-red-100 text-red-800',
                        'bg-pink-100 text-pink-800',
                        'bg-gray-100 text-gray-800'
                      ].map((color) => (
                        <button
                          key={color}
                          onClick={() => setStageColor(color)}
                          className={`p-2 rounded-lg border ${stageColor === color ? 'ring-2 ring-blue-500' : ''}`}
                          title={color}
                        >
                          <div className={`w-full h-8 rounded ${color}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setShowEditStageModal(false); setEditingStage(null); }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveStageEdit}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <FaCheck /> Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confirm Remove Candidate */}
          {showConfirmDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-md mx-4">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold">Remove Candidate</h2>
                </div>
                <div className="p-4">
                  <p className="text-gray-600 mb-4">
                    Are you sure you want to remove this candidate from the current view?
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setShowConfirmDialog(false); setCandidateToRemove(null); }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmRemoveCandidate}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <FaTrash /> Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Stage Modal */}
          {showNewStageModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-md mx-4">
                <div className="p-4 border-b flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Create New Stage</h2>
                  <button
                    onClick={() => { setShowNewStageModal(false); setNewStageTitle(''); setNewStageColor('bg-blue-100 text-blue-800'); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stage Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Phone Screen"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newStageTitle}
                      onChange={(e) => setNewStageTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stage Color</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        'bg-blue-100 text-blue-800',
                        'bg-yellow-100 text-yellow-800',
                        'bg-purple-100 text-purple-800',
                        'bg-green-100 text-green-800',
                        'bg-indigo-100 text-indigo-800',
                        'bg-red-100 text-red-800',
                        'bg-pink-100 text-pink-800',
                        'bg-gray-100 text-gray-800'
                      ].map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewStageColor(color)}
                          className={`p-2 rounded-lg border ${newStageColor === color ? 'ring-2 ring-blue-500' : ''}`}
                          title={color}
                        >
                          <div className={`w-full h-8 rounded ${color}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setShowNewStageModal(false); setNewStageTitle(''); setNewStageColor('bg-blue-100 text-blue-800'); }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateStage}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <FaCheck /> Create Stage
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Overwrite Pipeline Confirmation */}
          {showOverwritePipelineConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-md mx-4">
                <div className="p-4 border-b flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-red-600">
                    Overwrite Existing Pipeline?
                  </h2>
                </div>
                <div className="p-4">
                  <p className="mb-4 text-gray-700">
                    This job is already linked to a pipeline. Creating a new pipeline will unlink
                    the current one and link the new pipeline. Candidates will not be deleted, but
                    you may need to reassign them to stages in the new pipeline.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleOverwritePipelineCancel}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleOverwritePipelineConfirm}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <FaCheck /> Overwrite Pipeline
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Keyboard Shortcuts */}
          {showKeyboardShortcuts && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-md mx-4">
                <div className="p-4 border-b flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
                  <button
                    onClick={() => setShowKeyboardShortcuts(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes />
                  </button>
                </div>
                <div className="p-4 space-y-2 text-sm text-gray-700">
                  <div><b>Alt + N</b> — New Pipeline</div>
                  <div><b>Alt + A</b> — Add Candidate</div>
                  <div><b>Alt + S</b> — New Stage</div>
                  <div><b>Alt + K</b> — Show Shortcuts</div>
                </div>
                <div className="p-4 flex justify-end">
                  <button
                    onClick={() => setShowKeyboardShortcuts(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
