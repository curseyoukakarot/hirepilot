import React, { useState, useEffect, useMemo } from 'react';
import { FaPlus, FaEllipsisV, FaUserPlus, FaSearch, FaTimes, FaTrash, FaEdit, FaCheck, FaGripVertical, FaKeyboard } from 'react-icons/fa';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Default stages if none exist
const defaultStages = [
  { id: 'sourced', title: 'Sourced', color: 'bg-blue-100 text-blue-800', position: 0 },
  { id: 'contacted', title: 'Contacted', color: 'bg-yellow-100 text-yellow-800', position: 1 },
  { id: 'interviewed', title: 'Interviewed', color: 'bg-purple-100 text-purple-800', position: 2 },
  { id: 'offered', title: 'Offered', color: 'bg-green-100 text-green-800', position: 3 },
  { id: 'hired', title: 'Hired', color: 'bg-indigo-100 text-indigo-800', position: 4 }
];

const departments = ['Engineering', 'Sales', 'Product', 'Marketing', 'HR', 'Finance'];

// Mock available candidates for search - will be replaced with API call
// const availableCandidates = [
//   { id: 5, name: 'Alex Brown', avatar: 'https://ui-avatars.com/api/?name=Alex+Brown&background=random', email: 'alex@example.com' },
//   { id: 6, name: 'Emma Davis', avatar: 'https://ui-avatars.com/api/?name=Emma+Davis&background=random', email: 'emma@example.com' },
//   { id: 7, name: 'Chris Wilson', avatar: 'https://ui-avatars.com/api/?name=Chris+Wilson&background=random', email: 'chris@example.com' }
// ];

// Helper function to generate avatar URL
const getAvatarUrl = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

export default function JobPipeline() {
  const { id: jobId } = useParams();
  const [selectedPipeline, setSelectedPipeline] = useState('all');
  const [selectedJob, setSelectedJob] = useState(jobId || 'all');
  const [showModal, setShowModal] = useState(false);
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [showEditStageModal, setShowEditStageModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showNewStageModal, setShowNewStageModal] = useState(false);
  const [showDeleteStageConfirm, setShowDeleteStageConfirm] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [candidateToRemove, setCandidateToRemove] = useState(null);
  const [stageToDelete, setStageToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState(null);
  const [showStageMenu, setShowStageMenu] = useState(null);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineDepartment, setNewPipelineDepartment] = useState('');
  const [editingStage, setEditingStage] = useState(null);
  const [stageColor, setStageColor] = useState('');
  const [stageTitle, setStageTitle] = useState('');
  const [newStageTitle, setNewStageTitle] = useState('');
  const [newStageColor, setNewStageColor] = useState('bg-blue-100 text-blue-800');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState([]);
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [jobs, setJobs] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState(new Set());
  const [showOverwritePipelineConfirm, setShowOverwritePipelineConfirm] = useState(false);
  const [pendingPipelineData, setPendingPipelineData] = useState(null);
  const [pipelineExists, setPipelineExists] = useState(true);

  // Initialize candidates state with default stages
  const [candidates, setCandidates] = useState(
    defaultStages.reduce((acc, stage) => {
      acc[stage.id] = [];
      return acc;
    }, {})
  );

  // State for real candidates
  const [availableCandidates, setAvailableCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  // Add derived pipeline name using useMemo
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

  useEffect(() => {
    if (jobId) setSelectedJob(jobId);
  }, [jobId]);

  // Toast notification component
  const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);

      return () => clearTimeout(timer);
    }, [onClose]);

    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className={`px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 ${
          type === 'success' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
        }`}>
          <span>{message}</span>
          <button onClick={onClose} className="ml-2 hover:opacity-75">
            <FaTimes />
          </button>
        </div>
      </div>
    );
  };

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Hide toast notification
  const hideToast = () => {
    setToast({ show: false, message: '', type: '' });
  };

  const getSessionToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Not authenticated');
      throw new Error('Not authenticated');
    }
    return session.access_token;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only trigger if not typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Alt + N: New Pipeline
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowNewPipelineModal(true);
        showToast('Opening New Pipeline modal', 'success');
      }

      // Alt + A: Add Candidate
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleAddCandidate('sourced');
        showToast('Opening Add Candidate modal', 'success');
      }

      // Alt + S: New Stage
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setShowNewStageModal(true);
        showToast('Opening New Stage modal', 'success');
      }

      // Alt + K: Show Keyboard Shortcuts
      if (e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
        showToast('Opening Keyboard Shortcuts', 'success');
      }

      // Escape: Close all modals
      if (e.key === 'Escape') {
        const wasModalOpen = showModal || showNewPipelineModal || showEditStageModal || 
                           showConfirmDialog || showNewStageModal || showDeleteStageConfirm || 
                           showKeyboardShortcuts;
        
        setShowModal(false);
        setShowNewPipelineModal(false);
        setShowEditStageModal(false);
        setShowConfirmDialog(false);
        setShowNewStageModal(false);
        setShowDeleteStageConfirm(false);
        setShowKeyboardShortcuts(false);

        if (wasModalOpen) {
          showToast('Closing modal', 'success');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Refactor fetchStagesAndCandidates to be callable
  const fetchStagesAndCandidates = async () => {
    try {
      setLoading(true);
      if (!selectedJob || selectedJob === 'all') {
        setPipelineExists(false);
        setStages([]);
        setCandidates({});
        return;
      }
      const token = await getSessionToken();
      const pipelineRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/pipelines?jobId=${selectedJob}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!pipelineRes.ok) throw new Error('Failed to fetch pipelines');
      const pipelineData = await pipelineRes.json();
      setPipelines(pipelineData);
      if (!pipelineData.length) {
        setPipelineExists(false);
        setStages([]);
        setCandidates({});
        return;
      }
      const active = pipelineData[0];
      setSelectedPipeline(active.id);
      const stagesRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/pipelines/${active.id}/stages?jobId=${selectedJob}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!stagesRes.ok) throw new Error('Failed to fetch stages');
      const stageJson = await stagesRes.json();
      setStages(stageJson.stages || []);
      setCandidates(stageJson.candidates || {});
      setPipelineExists(true);
      setError(null);
    } catch (err) {
      console.error('Error loading pipeline stages or candidates:', err);
      setError('Failed to load pipeline stages or candidates');
    } finally {
      setLoading(false);
    }
  };

  // load stages and candidates when job or pipeline selection changes
  useEffect(() => {
    fetchStagesAndCandidates();
  }, [selectedJob, selectedPipeline]);

  // Realtime sync: reflect external moves (REX/Zapier/other clients)
  useEffect(() => {
    if (!selectedJob || selectedJob === 'all') return;
    const channel = supabase
      .channel(`pipeline-realtime-${selectedJob}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_jobs', filter: `job_id=eq.${selectedJob}` }, () => {
        fetchStagesAndCandidates();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_stages' }, () => {
        fetchStagesAndCandidates();
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [selectedJob]);


  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('job_requisitions')
          .select('*')
          .eq('user_id', user.id);
        if (error) {
          setJobs([]);
        } else {
          setJobs(data);
        }
      } catch (err) {
        setJobs([]);
      }
    };
    fetchJobs();
  }, []);

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, type } = result;
    // Handle stage reordering
    if (type === 'stage') {
      const newStages = Array.from(stages);
      const [removed] = newStages.splice(source.index, 1);
      newStages.splice(destination.index, 0, removed);

      // Update positions
      const updatedStages = newStages.map((stage, index) => ({
        ...stage,
        position: index
      }));

      try {
        const token = await getSessionToken();
        const pipelineId = selectedPipeline || stages[0]?.pipeline_id;
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/pipelines/${pipelineId}/stages/reorder`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ stages: updatedStages.map(stage => ({ id: stage.id, position: stage.position })) })
        });
        if (!res.ok) throw new Error('Failed');
        setStages(updatedStages);
        toast.success('Pipeline stages reordered');
      } catch (error) {
        console.error('Error reordering stages:', error);
        toast.error('Failed to reorder pipeline stages');
      }
      return;
    }
    // Handle candidate reordering/moving
    const sourceStage = source.droppableId;
    const destStage = destination.droppableId;
    if (sourceStage === destStage) {
      // Reorder within the same stage (UI only)
      const newCandidates = Array.from(candidates[sourceStage] || []);
      const [removed] = newCandidates.splice(source.index, 1);
      newCandidates.splice(destination.index, 0, removed);
      setCandidates({
        ...candidates,
        [sourceStage]: newCandidates
      });
    } else {
      // Move to different stage via backend API
      const sourceCandidates = Array.from(candidates[sourceStage] || []);
      const destCandidates = Array.from(candidates[destStage] || []);
      const [removed] = sourceCandidates.splice(source.index, 1);
      if (removed) {
        const stageTitle = stages.find(s => String(s.id) === String(destStage))?.title;
        const token = await getSessionToken();
        const pipelineId = selectedPipeline || stages[0]?.pipeline_id;
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/pipelines/${pipelineId}/candidates/${removed.candidate_id}/move`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ jobId: selectedJob, stageId: destStage, stageTitle })
        });
        if (!res.ok) {
          toast.error('Failed to update candidate stage');
          return;
        }
        destCandidates.splice(destination.index, 0, removed);
        setCandidates({
          ...candidates,
          [sourceStage]: sourceCandidates,
          [destStage]: destCandidates
        });
      }
    }
  };

  const handleAddCandidate = (stageId) => {
    setSelectedStage(stageId);
    setShowModal(true);
  };

  const handleSelectCandidate = async (candidate) => {
    if (selectedStage && selectedJob) {
      // Insert into candidate_jobs
      const { data, error } = await supabase
        .from('candidate_jobs')
        .insert({
          candidate_id: candidate.id,
          job_id: selectedJob,
          stage_id: selectedStage
        });
      if (!error) {
        setCandidates({
          ...candidates,
          [selectedStage]: [...(candidates[selectedStage] || []), candidate]
        });
      } else {
        toast.error('Failed to add candidate to stage');
      }
    }
    setShowModal(false);
    setSelectedStage(null);
    setSearchQuery('');
  };

  const handleRemoveStage = (stageId) => {
    setStageToDelete(stageId);
    setShowDeleteStageConfirm(true);
    setShowStageMenu(null);
  };

  const confirmDeleteStage = async () => {
    if (stageToDelete) {
      try {
        const token = await getSessionToken();
        const pipelineId = selectedPipeline || stages[0]?.pipeline_id;
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/pipelines/${pipelineId}/stages/${stageToDelete}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) throw new Error('Failed');
        setStages(stages.filter(stage => stage.id !== stageToDelete));

        const newCandidates = { ...candidates };
        delete newCandidates[stageToDelete];
        setCandidates(newCandidates);

        toast.success('Stage deleted');
      } catch (error) {
        console.error('Error deleting stage:', error);
        toast.error('Failed to delete stage');
      }
    }
    setShowDeleteStageConfirm(false);
    setStageToDelete(null);
  };

  const handleRemoveCandidate = (stageId, candidateId) => {
    setCandidateToRemove({ stageId, candidateId });
    setShowConfirmDialog(true);
  };

  const confirmRemoveCandidate = () => {
    if (candidateToRemove) {
      setCandidates({
        ...candidates,
        [candidateToRemove.stageId]: candidates[candidateToRemove.stageId].filter(
          c => c.id !== candidateToRemove.candidateId
        )
      });
    }
    setShowConfirmDialog(false);
    setCandidateToRemove(null);
  };

  const handleCreatePipeline = async () => {
    try {
      const token = await getSessionToken();
      if (!selectedJob || selectedJob === 'all') {
        showToast('Please select a job before creating a pipeline.', 'error');
        return;
      }
      const existingRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/pipelines?jobId=${selectedJob}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      console.error('Error creating pipeline:', err);
      showToast('Failed to create pipeline', 'error');
    }
  };

  // Helper to actually create and link pipeline
  const actuallyCreatePipeline = async (pipelineName, pipelineDepartment, existingToken) => {
    const token = existingToken || await getSessionToken();
    const payload = {
      name: pipelineName,
      department: pipelineDepartment,
      job_id: selectedJob,
      stages: defaultStages.map((stage, idx) => ({ name: stage.title, icon: '', color: stage.color, position: idx }))
    };
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/pipelines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create pipeline');
    await fetchStagesAndCandidates();
    setShowNewPipelineModal(false);
    setNewPipelineName('');
    setNewPipelineDepartment('');
    showToast('Pipeline created with default stages!', 'success');
  };

  // Handler for confirming overwrite
  const handleOverwritePipelineConfirm = async () => {
    setShowOverwritePipelineConfirm(false);
    if (pendingPipelineData) {
      await actuallyCreatePipeline(pendingPipelineData.name, pendingPipelineData.department);
      setPendingPipelineData(null);
    }
  };

  // Handler for canceling overwrite
  const handleOverwritePipelineCancel = () => {
    setShowOverwritePipelineConfirm(false);
    setPendingPipelineData(null);
  };

  const handleEditStage = (stage) => {
    setEditingStage(stage);
    setStageColor(stage.color);
    setStageTitle(stage.title);
    setShowEditStageModal(true);
    setShowStageMenu(null);
  };

  const handleSaveStageEdit = async () => {
    try {
      const token = await getSessionToken();
    const pipelineId = selectedPipeline || stages[0]?.pipeline_id;
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/pipelines/${pipelineId}/stages/${editingStage.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ title: stageTitle, color: stageColor })
      });
      if (!res.ok) throw new Error('Failed');
      const updatedStage = await res.json();
      setStages(stages.map(stage =>
        stage.id === editingStage.id ? updatedStage : stage
      ));
      setShowEditStageModal(false);
      setEditingStage(null);
      toast.success('Stage updated');
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Failed to update stage');
    }
  };

  const handleCreateStage = async () => {
    if (selectedJob === 'all') {
      toast.error('Please select a job first');
      return;
    }

    const newStageId = newStageTitle.toLowerCase().replace(/\s+/g, '_');
    const position = stages.length;

    try {
      const token = await getSessionToken();
    const pipelineId = selectedPipeline || stages[0]?.pipeline_id;
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/pipelines/${pipelineId}/stages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ title: newStageTitle, color: newStageColor, position })
      });
      if (!res.ok) throw new Error('Failed');
      const newStage = await res.json();

      setStages([...stages, newStage]);
      setCandidates({
        ...candidates,
        [newStage.id]: []
      });

      setShowNewStageModal(false);
      setNewStageTitle('');
      setNewStageColor('bg-blue-100 text-blue-800');
      toast.success('New stage created');
    } catch (error) {
      console.error('Error creating stage:', error);
      toast.error('Failed to create new stage');
    }
  };

  // Fetch real candidates when Add Candidate modal is opened
  useEffect(() => {
    const fetchAvailableCandidates = async () => {
      if (!showModal || !selectedJob || selectedJob === 'all') return;
      setCandidatesLoading(true);
      try {
        // Fetch all candidates
        const { data: allCandidates, error } = await supabase
          .from('candidates')
          .select('id, first_name, last_name, email, avatar_url');
        if (error) throw error;
        // Get candidate_ids already in this job's pipeline
        const { data: jobCandidates, error: jobCandidatesError } = await supabase
          .from('candidate_jobs')
          .select('candidate_id')
          .eq('job_id', selectedJob);
        if (jobCandidatesError) throw jobCandidatesError;
        const usedIds = new Set((jobCandidates || []).map(cj => cj.candidate_id));
        // Only show candidates not already in the pipeline
        setAvailableCandidates((allCandidates || []).filter(c => !usedIds.has(c.id)));
      } catch (err) {
        setAvailableCandidates([]);
      } finally {
        setCandidatesLoading(false);
      }
    };
    fetchAvailableCandidates();
  }, [showModal, selectedJob]);

  // Filter/search candidates
  const filteredCandidates = availableCandidates.filter(candidate =>
    (`${candidate.first_name} ${candidate.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (candidate.email || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Add image error handler
  const handleImageError = (e) => {
    e.target.onerror = null; // Prevent infinite loop
    const name = e.target.alt || 'User';
    e.target.src = getAvatarUrl(name);
  };

  // Filter/search pipelines
  const filteredPipelines = pipelines.filter(p =>
    (p.name || '').toLowerCase().includes(pipelineSearch.toLowerCase()) ||
    (p.department || '').toLowerCase().includes(pipelineSearch.toLowerCase())
  );

  const handleBulkSelect = (candidateId) => {
    setSelectedCandidates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId);
      } else {
        newSet.add(candidateId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedCandidates.size === 0) return;

    try {
      const { error } = await supabase
        .from('candidate_jobs')
        .delete()
        .in('id', Array.from(selectedCandidates));

      if (error) throw error;

      // Update local state
      const newCandidates = { ...candidates };
      Object.keys(newCandidates).forEach(stageId => {
        newCandidates[stageId] = newCandidates[stageId].filter(
          candidate => !selectedCandidates.has(candidate.id)
        );
      });
      setCandidates(newCandidates);
      setSelectedCandidates(new Set());
      toast.success('Selected candidates removed successfully');
    } catch (err) {
      console.error('Error deleting candidates:', err);
      toast.error('Failed to delete candidates');
    }
  };

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
          <div className="flex-none">
            <h1 className="text-3xl font-bold text-gray-900 mb-6 px-6 pt-8">
              {pipelineName}
            </h1>
          </div>
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-semibold text-gray-900">Job Pipeline</h1>
                <select
                  className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedPipeline}
                  onChange={(e) => setSelectedPipeline(e.target.value)}
                >
                  <option value="all">All Pipelines</option>
                  {filteredPipelines.map(pipeline => (
                    <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
                  ))}
                </select>
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
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button 
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200"
                  onClick={() => setShowNewPipelineModal(true)}
                  title="Alt + N"
                >
                  <FaPlus /> New Pipeline
                </button>
                <button 
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200"
                  onClick={() => setShowNewStageModal(true)}
                  title="Alt + S"
                >
                  <FaPlus /> New Stage
                </button>
                <button 
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                  onClick={() => handleAddCandidate('sourced')}
                  title="Alt + A"
                >
                  <FaUserPlus /> Add Candidate
                </button>
                <button
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200"
                  onClick={() => setShowKeyboardShortcuts(true)}
                  title="Alt + K"
                >
                  <FaKeyboard />
                </button>
              </div>
              {selectedCandidates.size > 0 && (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {selectedCandidates.size} selected
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700"
                  >
                    <FaTrash /> Delete Selected
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-6 py-8">
            {!pipelineExists ? (
              <div className="min-h-[300px] flex flex-col items-center justify-center">
                <div className="text-red-600 text-lg font-semibold mb-4">
                  This job has no pipeline! To add stages, click <b>New Pipeline</b> and create a pipeline directly from this page.
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
                        <Draggable
                          key={stage.id}
                          draggableId={stage.id}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="w-80 flex-shrink-0"
                            >
                              <div className="bg-white rounded-lg shadow-sm border">
                                {/* Stage Header */}
                                <div className="p-4 border-b">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <div {...provided.dragHandleProps} className="cursor-grab">
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
                                        onClick={() => setShowStageMenu(showStageMenu === stage.id ? null : stage.id)}
                                      >
                                        <FaEllipsisV />
                                      </button>
                                      {showStageMenu === stage.id && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-10">
                                          <button
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                            onClick={() => handleRemoveStage(stage.id)}
                                          >
                                            <FaTrash className="text-red-500" /> Clear Stage
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
                                </div>

                                {/* Stage Content */}
                                <Droppable droppableId={stage.id}>
                                  {(provided) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      className="h-full overflow-y-auto px-2 min-h-[200px]"
                                    >
                                      {(candidates[stage.id] || []).map((candidate, index) => (
                                        <Draggable
                                          key={String(candidate.id)}
                                          draggableId={String(candidate.id)}
                                          index={index}
                                        >
                                          {(provided) => (
                                            <div
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              className={`p-3 mb-2 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow`}
                                            >
                                              <div className="flex items-center gap-3">
                                                <span {...provided.dragHandleProps} className="cursor-grab text-gray-400 flex items-center pr-1">
                                                  <FaGripVertical />
                                                </span>
                                                <img
                                                  src={candidate.avatar_url || getAvatarUrl(candidate.name)}
                                                  alt={candidate.name}
                                                  className="w-10 h-10 rounded-full"
                                                  onError={handleImageError}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-medium text-gray-900 truncate">
                                                    {candidate.name}
                                                  </p>
                                                  <p className="text-sm text-gray-500 truncate">
                                                    {candidate.email}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}
                                      {provided.placeholder}
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

          {/* Quick Search Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-md mx-4">
                <div className="p-4 border-b flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Add Candidate</h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setSelectedStage(null);
                      setSearchQuery('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes />
                  </button>
                </div>
                <div className="p-4">
                  <div className="relative mb-4">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
                      filteredCandidates.map(candidate => (
                        <button
                          key={candidate.id}
                          onClick={() => handleSelectCandidate(candidate)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg mb-2"
                        >
                          <img
                            src={candidate.avatar_url || getAvatarUrl(`${candidate.first_name} ${candidate.last_name}`)}
                            alt={`${candidate.first_name} ${candidate.last_name}`}
                            className="w-10 h-10 rounded-full"
                            onError={handleImageError}
                          />
                          <div className="text-left">
                            <div className="font-medium text-gray-900">{candidate.first_name} {candidate.last_name}</div>
                            <div className="text-sm text-gray-500">{candidate.email}</div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-4">
                        No candidates found
                      </div>
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
                    onClick={() => {
                      setShowNewPipelineModal(false);
                      setNewPipelineName('');
                      setNewPipelineDepartment('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes />
                  </button>
                </div>
                <div className="p-4">
                  {/* Show selected job info */}
                  {selectedJob !== 'all' ? (
                    <div className="mb-4 text-sm text-gray-700">
                      <b>Selected Job:</b> {jobs.find(j => j.id === selectedJob)?.title || selectedJob}
                    </div>
                  ) : (
                    <div className="mb-4 text-sm text-red-600">
                      <b>No job selected!</b> Please select a job before creating a pipeline.
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pipeline Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Engineering Pipeline"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={newPipelineName}
                        onChange={(e) => setNewPipelineName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department
                      </label>
                      <select
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={newPipelineDepartment}
                        onChange={(e) => setNewPipelineDepartment(e.target.value)}
                      >
                        <option value="">Select Department</option>
                        {departments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowNewPipelineModal(false);
                          setNewPipelineName('');
                          setNewPipelineDepartment('');
                        }}
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
                    onClick={() => {
                      setShowEditStageModal(false);
                      setEditingStage(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes />
                  </button>
                </div>
                <div className="p-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stage Name
                      </label>
                      <input
                        type="text"
                        value={stageTitle}
                        onChange={(e) => setStageTitle(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stage Color
                      </label>
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
                            className={`p-2 rounded-lg border ${
                              stageColor === color ? 'ring-2 ring-blue-500' : ''
                            }`}
                          >
                            <div className={`w-full h-8 rounded ${color}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowEditStageModal(false);
                          setEditingStage(null);
                        }}
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
            </div>
          )}

          {/* Confirmation Dialog */}
          {showConfirmDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-md mx-4">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold">Remove Candidate</h2>
                </div>
                <div className="p-4">
                  <p className="text-gray-600 mb-4">
                    Are you sure you want to remove this candidate from the pipeline? This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowConfirmDialog(false);
                        setCandidateToRemove(null);
                      }}
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
                    onClick={() => {
                      setShowNewStageModal(false);
                      setNewStageTitle('');
                      setNewStageColor('bg-blue-100 text-blue-800');
                    }}
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
                        >
                          <div className={`w-full h-8 rounded ${color}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowNewStageModal(false);
                        setNewStageTitle('');
                        setNewStageColor('bg-blue-100 text-blue-800');
                      }}
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

          {/* Overwrite Pipeline Confirmation Modal */}
          {showOverwritePipelineConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-md mx-4">
                <div className="p-4 border-b flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-red-600">Overwrite Existing Pipeline?</h2>
                </div>
                <div className="p-4">
                  <p className="mb-4 text-gray-700">
                    This job is already linked to a pipeline. Creating a new pipeline will unlink the current one and link the new pipeline. Candidates will not be deleted, but you may need to reassign them to stages in the new pipeline.
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

          {/* Toast Notification */}
          {toast.show && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={hideToast}
            />
          )}
        </div>
      </div>
    </div>
  );
}
