import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaEllipsisV, FaTrash, FaTimes, FaEdit } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { apiDelete } from '../lib/api';

export default function JobRequisitions() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [jobs, setJobs] = useState([]);
  const [pipelines, setPipelines] = useState({});
  const [candidateCounts, setCandidateCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(null);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobDepartment, setNewJobDepartment] = useState('');
  const [newJobStatus, setNewJobStatus] = useState('open');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [showEditStatusModal, setShowEditStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    const fetchJobsAndRelated = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        // Determine if guest collaborator
        let isGuest = false;
        try {
          const { data: guestAny } = await supabase
            .from('job_guest_collaborators')
            .select('job_id')
            .eq('email', user.email);
          isGuest = (guestAny || []).length > 0;
        } catch {}

        let jobsData = [];
        if (isGuest) {
          // Fetch only jobs the guest has access to
          const { data: guestRows } = await supabase
            .from('job_guest_collaborators')
            .select('job_id')
            .eq('email', user.email);
          const ids = [...new Set((guestRows || []).map(r => r.job_id).filter(Boolean))];
          if (ids.length) {
            const { data, error } = await supabase
              .from('job_requisitions')
              .select('*')
              .in('id', ids)
              .order('created_at', { ascending: false });
            if (error) throw error;
            jobsData = data || [];
          }
        } else {
          // Owner/team view: jobs by user_id AND jobs where user is a collaborator
          const { data: ownedJobs, error: ownedError } = await supabase
            .from('job_requisitions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (ownedError) throw ownedError;
          
          // Fetch jobs where user is a collaborator
          const { data: collaboratorJobs, error: collabError } = await supabase
            .from('job_collaborators')
            .select('job_id, job_requisitions(*)')
            .eq('user_id', user.id);
          if (collabError) throw collabError;
          
          const ownedJobsList = ownedJobs || [];
          const collaboratorJobsList = (collaboratorJobs || []).map(c => c.job_requisitions).filter(Boolean);
          
          // Merge and deduplicate
          const allJobsMap = new Map();
          [...ownedJobsList, ...collaboratorJobsList].forEach(job => {
            allJobsMap.set(job.id, { ...job, is_shared: job.user_id !== user.id });
          });
          
          jobsData = Array.from(allJobsMap.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        // Fetch jobs referenced by campaigns for this user
        const { data: campaignJobs, error: campaignJobsError } = await supabase
          .from('campaigns')
          .select('job_id')
          .eq('user_id', user.id)
          .not('job_id', 'is', null);
        if (campaignJobsError) throw campaignJobsError;
        const campaignJobIds = (campaignJobs || []).map(c => c.job_id).filter(Boolean);
        // Fetch those jobs if not already in jobsData
        const missingJobIds = campaignJobIds.filter(id => !jobsData.some(j => j.id === id));
        let extraJobs = [];
        if (missingJobIds.length > 0) {
          const { data: extra, error: extraError } = await supabase
            .from('job_requisitions')
            .select('*')
            .in('id', missingJobIds);
          if (extraError) throw extraError;
          extraJobs = extra || [];
        }
        // Merge and deduplicate
        const allJobs = [...jobsData, ...extraJobs];
        // Fetch pipelines for jobs
        const pipelineIds = allJobs.map(j => j.pipeline_id).filter(Boolean);
        let pipelinesMap = {};
        if (pipelineIds.length > 0) {
          const { data: pipelineRows, error: pipelineError } = await supabase
            .from('pipelines')
            .select('*')
            .in('id', pipelineIds);
          if (pipelineError) throw pipelineError;
          pipelinesMap = Object.fromEntries((pipelineRows || []).map(p => [p.id, p]));
        }
        // Fetch candidate counts for each job
        const jobIds = allJobs.map(j => j.id);
        let countsMap = {};
        if (jobIds.length > 0) {
          const { data: candidateRows, error: candidateError } = await supabase
            .from('candidate_jobs')
            .select('job_id')
            .in('job_id', jobIds);
          if (candidateError) throw candidateError;
          countsMap = jobIds.reduce((acc, jobId) => {
            acc[jobId] = (candidateRows || []).filter(row => row.job_id === jobId).length;
            return acc;
          }, {});
        }
        setJobs(allJobs);
        setPipelines(pipelinesMap);
        setCandidateCounts(countsMap);
      } catch (err) {
        setError(err.message || 'Failed to load jobs');
      } finally {
        setLoading(false);
      }
    };
    fetchJobsAndRelated();
  }, []);

  const handleViewPipeline = (jobId) => {
    navigate(`/job/${jobId}/pipeline`);
  };

  // Filter jobs by search, status, department
  const filteredJobs = jobs.filter(job => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.department || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || job.status === selectedStatus;
    const matchesDept = selectedDepartment === 'all' || (job.department || '').toLowerCase() === selectedDepartment.toLowerCase();
    return matchesSearch && matchesStatus && matchesDept;
  });

  // Bulk selection logic
  const handleSelectJob = (jobId) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleSelectAll = () => {
    if (selectedJobs.length === filteredJobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(filteredJobs.map((job) => job.id));
    }
  };

  const handleBulkDelete = async () => {
    try {
      const response = await apiDelete('/api/deleteJobRequisitions', {
        body: JSON.stringify({ ids: selectedJobs }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.warning) {
        const campaignTitles = response.campaigns.map(c => c.title).join(', ');
        if (
          window.confirm(
            `Some jobs are linked to campaigns (${campaignTitles}). Deleting will also remove those campaigns. Continue?`
          )
        ) {
          // User confirmed, send with force: true
          await apiDelete('/api/deleteJobRequisitions', {
            body: JSON.stringify({ ids: selectedJobs, force: true }),
            headers: { 'Content-Type': 'application/json' }
          });
          setJobs((prev) => prev.filter((job) => !selectedJobs.includes(job.id)));
          setSelectedJobs([]);
        }
        // If user cancels, do nothing
        return;
      }

      // No warning, deletion succeeded
      setJobs((prev) => prev.filter((job) => !selectedJobs.includes(job.id)));
      setSelectedJobs([]);
    } catch (err) {
      alert('Failed to delete jobs: ' + (err.message || err));
    }
  };

  const handleDeleteJob = (job) => {
    setJobToDelete(job);
    setShowDeleteDialog(true);
  };

  const handleConfirmDeleteJob = async () => {
    if (!jobToDelete) return;
    try {
      const response = await apiDelete('/api/deleteJobRequisitions', {
        body: JSON.stringify({ ids: [jobToDelete.id] }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.warning) {
        const campaignTitles = response.campaigns.map(c => c.title).join(', ');
        if (
          window.confirm(
            `This job is linked to campaigns (${campaignTitles}). Deleting will also remove those campaigns. Continue?`
          )
        ) {
          await apiDelete('/api/deleteJobRequisitions', {
            body: JSON.stringify({ ids: [jobToDelete.id], force: true }),
            headers: { 'Content-Type': 'application/json' }
          });
          setJobs((prev) => prev.filter((job) => job.id !== jobToDelete.id));
        }
        setShowDeleteDialog(false);
        setJobToDelete(null);
        return;
      }
      setJobs((prev) => prev.filter((job) => job.id !== jobToDelete.id));
      setShowDeleteDialog(false);
      setJobToDelete(null);
    } catch (err) {
      alert('Failed to delete job: ' + (err.message || err));
      setShowDeleteDialog(false);
      setJobToDelete(null);
    }
  };

  const handleOpenNewJobModal = () => {
    setShowNewJobModal(true);
  };

  const handleCloseNewJobModal = () => {
    setShowNewJobModal(false);
    setNewJobTitle('');
    setNewJobDepartment('');
    setNewJobStatus('open');
  };

  const handleCreateNewJob = async () => {
    if (!newJobTitle.trim()) {
      alert('Job title is required');
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('job_requisitions')
        .insert({
          title: newJobTitle,
          department: newJobDepartment,
          status: newJobStatus,
          user_id: user.id
        })
        .select();
      if (error) throw error;
      setJobs((prev) => [data[0], ...prev]);
      handleCloseNewJobModal();
    } catch (err) {
      alert('Failed to create job: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditStatusModal = (job) => {
    setJobToEdit(job);
    setNewStatus(job.status);
    setShowEditStatusModal(true);
  };

  const handleCloseEditStatusModal = () => {
    setShowEditStatusModal(false);
    setJobToEdit(null);
    setNewStatus('');
  };

  const handleUpdateJobStatus = async () => {
    if (!jobToEdit || !newStatus) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('job_requisitions')
        .update({ status: newStatus })
        .eq('id', jobToEdit.id);
      if (error) throw error;
      setJobs((prev) => prev.map((job) => (job.id === jobToEdit.id ? { ...job, status: newStatus } : job)));
      handleCloseEditStatusModal();
    } catch (err) {
      alert('Failed to update job status: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Job Requisitions</h1>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700" onClick={handleOpenNewJobModal}>
            <FaPlus /> New Job
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Bulk Delete Button */}
        {selectedJobs.length > 0 && (
          <div className="mb-4 flex justify-end">
            <button
              className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700"
              onClick={handleBulkDelete}
            >
              <FaTrash /> Delete Selected ({selectedJobs.length})
            </button>
          </div>
        )}
        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search jobs..."
                  className="w-full pl-4 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="draft">Draft</option>
              </select>
              <select
                className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="all">All Departments</option>
                <option value="engineering">Engineering</option>
                <option value="product">Product</option>
                <option value="design">Design</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading/Error States */}
        {loading ? (
          <div className="flex justify-center items-center py-12 text-gray-500">Loading jobs...</div>
        ) : error ? (
          <div className="flex justify-center items-center py-12 text-red-500">{error}</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedJobs.length === filteredJobs.length && filteredJobs.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className={selectedJobs.includes(job.id) ? 'bg-blue-50' : ''}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(job.id)}
                        onChange={() => handleSelectJob(job.id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-sm font-medium text-gray-900 hover:underline"
                          onClick={() => navigate(`/job/${job.id}`)}
                        >
                          {job.title}
                        </button>
                        {job.is_shared && (
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                            Shared
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{job.department || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        job.status === 'open' ? 'bg-green-100 text-green-800' :
                        job.status === 'closed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.pipeline_id && pipelines[job.pipeline_id]?.name ? pipelines[job.pipeline_id].name : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {candidateCounts[job.id] ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.created_at ? new Date(job.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                      <button 
                        className="text-blue-600 hover:text-blue-900 mr-4"
                        onClick={() => handleViewPipeline(job.id)}
                      >
                        View Pipeline
                      </button>
                      <div className="inline-block relative">
                        <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowActionsMenu(showActionsMenu === job.id ? null : job.id)}>
                          <FaEllipsisV />
                        </button>
                        {showActionsMenu === job.id && (
                          <div className="absolute right-0 mt-2 w-40 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                            <div className="py-1" role="menu" aria-orientation="vertical">
                              <button
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                onClick={() => { setShowActionsMenu(null); handleDeleteJob(job); }}
                              >
                                <FaTrash className="mr-2" /> Delete
                              </button>
                              <button
                                className="flex items-center w-full px-4 py-2 text-sm text-blue-600 hover:bg-gray-100"
                                onClick={() => { setShowActionsMenu(null); handleOpenEditStatusModal(job); }}
                              >
                                <FaEdit className="mr-2" /> Change Status
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredJobs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">No jobs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-500">
            Showing 1 to {filteredJobs.length} of {filteredJobs.length} results
          </div>
          <div className="flex gap-2">
            <button className="border px-4 py-2 rounded-lg hover:bg-gray-50">
              Previous
            </button>
            <button className="border px-4 py-2 rounded-lg bg-blue-600 text-white">
              1
            </button>
            <button className="border px-4 py-2 rounded-lg hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Delete Job</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <b>{jobToDelete?.title}</b>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => { setShowDeleteDialog(false); setJobToDelete(null); }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                onClick={handleConfirmDeleteJob}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Job Modal */}
      {showNewJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Create New Job</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={handleCloseNewJobModal}>
                <FaTimes />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <input
                type="text"
                value={newJobTitle}
                onChange={(e) => setNewJobTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter job title"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input
                type="text"
                value={newJobDepartment}
                onChange={(e) => setNewJobDepartment(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter department"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={newJobStatus}
                onChange={(e) => setNewJobStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={handleCloseNewJobModal}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                onClick={handleCreateNewJob}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Status Modal */}
      {showEditStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Change Job Status</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={handleCloseEditStatusModal}>
                <FaTimes />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={handleCloseEditStatusModal}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                onClick={handleUpdateJobStatus}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 