import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PipelineBoard from '../components/pipeline/PipelineBoard';
import CreatePipelineModal from '../components/CreatePipelineModal';
import SubmitCandidateModal from '../components/pipeline/SubmitCandidateModal';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export default function JobPipeline({ embedded = false, jobId: jobIdProp = null }) {
  const { id: jobIdParam } = useParams();
  const navigate = useNavigate();
  const jobId = jobIdProp || jobIdParam || '';

  const [jobs, setJobs] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [selectedJob, setSelectedJob] = useState(jobId);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineDepartment, setNewPipelineDepartment] = useState('');
  const [showCreatePipelineModal, setShowCreatePipelineModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedJobTitle, setSelectedJobTitle] = useState('');
  const defaultStages = [
    { name: 'Sourced', color: 'bg-blue-100 text-blue-800' },
    { name: 'Contacted', color: 'bg-yellow-100 text-yellow-800' },
    { name: 'Interview', color: 'bg-purple-100 text-purple-800' },
    { name: 'Offer', color: 'bg-green-100 text-green-800' }
  ];

  useEffect(() => { if (jobId) setSelectedJob(jobId); }, [jobId]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('job_requisitions').select('id,title').eq('user_id', user.id);
        setJobs(data || []);
      } catch { setJobs([]); }
    })();
  }, []);

  const loadPipelines = async (job) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token || !job) { setPipelines([]); setSelectedPipeline(''); return; }
      
      // Get job title for the modal
      const { data: jobData } = await supabase
        .from('job_requisitions')
        .select('title')
        .eq('id', job)
        .single();
      
      if (jobData) {
        setSelectedJobTitle(jobData.title || 'Job');
      }
      
      const base = import.meta.env.VITE_BACKEND_URL;
      const res = await fetch(`${base}/api/pipelines?jobId=${job}`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      if (!res.ok) { setPipelines([]); setSelectedPipeline(''); return; }
      const js = await res.json();
      const list = Array.isArray(js) ? js : (js?.pipeline ? [js.pipeline] : (Array.isArray(js?.pipelines) ? js.pipelines : []));
      setPipelines(list);
      setSelectedPipeline(list[0]?.id ? String(list[0].id) : '');
      } catch {
      setPipelines([]); setSelectedPipeline('');
    }
  };

  useEffect(() => { if (selectedJob) loadPipelines(selectedJob); }, [selectedJob]);

  const handleCreatePipeline = () => {
    if (!selectedJob) {
      toast.error('Please select a job first');
      return;
    }
    setShowCreatePipelineModal(true);
  };

  const handlePipelineCreated = (pipelineData) => {
    // Handle both pipeline objects and pipeline IDs for backward compatibility
    const pipelineId = typeof pipelineData === 'string' ? pipelineData : pipelineData?.id;
    if (pipelineId) {
      setSelectedPipeline(String(pipelineId));
      loadPipelines(selectedJob);
      setRefreshKey(k => k + 1);
    }
  };

  const handleNewStageClick = async () => {
    if (!selectedJob) {
      toast.error('Please select a job first');
      return;
    }
    if (!selectedPipeline) {
      toast.error('Please create a pipeline before adding stages.');
      setShowCreatePipelineModal(true);
      return;
    }
    
    // Normal new stage logic
    const title = prompt('Stage name');
    if (!title) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const base = import.meta.env.VITE_BACKEND_URL;
      await fetch(`${base}/api/pipelines/${selectedPipeline}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ title, color: 'bg-blue-100 text-blue-800', position: 0 })
      });
      setRefreshKey(k => k + 1);
      toast.success(`✅ Stage "${title}" created successfully!`);
    } catch (e) { 
      console.error(e);
      toast.error('❌ Failed to create stage');
    }
  };

  const createPipeline = async () => {
    if (!selectedJob || !newPipelineName) return;
    try {
      setCreating(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const base = import.meta.env.VITE_BACKEND_URL;
      
      // Simplified payload - backend will handle default stages
      const payload = {
        name: newPipelineName,
        department: newPipelineDepartment,
        job_id: selectedJob
      };
      
      const res = await fetch(`${base}/api/pipelines`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
        credentials: 'include', 
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const created = await res.json();
        await loadPipelines(selectedJob);
        const pid = created?.pipeline?.id || created?.id;
        if (pid) setSelectedPipeline(String(pid));
        setRefreshKey(k => k + 1);
        setNewPipelineName(''); 
        setNewPipelineDepartment('');
        
        // Show success message
        console.log('✅ Pipeline created with default stages:', created.message);
      } else {
        const error = await res.json();
        alert('Failed to create pipeline: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Pipeline creation error:', error);
      alert('Failed to create pipeline: ' + error.message);
    } finally { 
      setCreating(false); 
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="w-full flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-semibold text-gray-900">Job Pipeline</h1>
                <select
                  className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[220px]"
              value={selectedJob}
              onChange={(e) => { const next = e.target.value; setSelectedJob(next); if (next && next !== 'all') navigate(`/job/${next}/pipeline`); }}
            >
              <option value="">Select Job</option>
              {jobs.map(j => (<option key={j.id} value={j.id}>{j.title}</option>))}
                </select>
                <select
                  className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[260px]"
              value={selectedPipeline}
              onChange={(e) => { setSelectedPipeline(e.target.value); setRefreshKey(k => k + 1); }}
            >
              <option value="">Select Pipeline</option>
              {pipelines.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <span className="text-sm text-gray-500 ml-2 truncate max-w-md">
              {pipelines.find(p => String(p.id) === String(selectedPipeline))?.name || ''}
                </span>
              </div>

              <div className="flex gap-2 flex-nowrap">
                <button
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 whitespace-nowrap min-w-[130px]"
                  onClick={handleCreatePipeline}
                >
                  <span className="font-medium">+ New Pipeline</span>
                </button>
                <button
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 whitespace-nowrap min-w-[120px]"
                  onClick={handleNewStageClick}
                >
                  <span className="font-medium">+ New Stage</span>
                </button>
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 whitespace-nowrap min-w-[170px]"
                  onClick={() => {
                    if (!selectedJob) { toast.error('Please select a job first'); return; }
                    setShowSubmitModal(true);
                  }}
                >
                  <span className="font-medium">+ Submit Candidate</span>
                </button>
                </div>
            </div>
          </header>

      <div className="flex-1 overflow-hidden">
        <PipelineBoard jobId={selectedJob} pipelineIdOverride={selectedPipeline || null} refreshKey={refreshKey} showHeader={false} />
      </div>

      {/* Create Pipeline Modal */}
      {showCreatePipelineModal && (
        <CreatePipelineModal
          jobId={selectedJob}
          jobTitle={selectedJobTitle}
          onClose={() => setShowCreatePipelineModal(false)}
          onPipelineCreated={handlePipelineCreated}
        />
      )}

      {/* Submit Candidate Modal */}
      {showSubmitModal && (
        <SubmitCandidateModal
          open={showSubmitModal}
          jobId={selectedJob}
          onClose={() => setShowSubmitModal(false)}
        />
      )}
    </div>
  );
}


