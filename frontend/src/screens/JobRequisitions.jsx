import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaEllipsisV, FaTrash, FaTimes, FaEdit } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { apiDelete } from '../lib/api';
import NewJobModal from '../components/NewJobModal';

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
  const [jobToEdit, setJobToEdit] = useState(null);
  const [showEditStatusModal, setShowEditStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const JOBS_PER_PAGE = 25;

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showActionsMenu && !event.target.closest('.actions-menu')) {
        setShowActionsMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsMenu]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, selectedDepartment]);

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
          // Use RLS policies to get all accessible jobs (owned, collaborated, team)
          // This single query will return all jobs the user can see based on RLS
          const { data: allJobs, error: jobsError } = await supabase
            .from('job_requisitions')
            .select(`
              *,
              job_collaborators!left(user_id, role)
            `)
            .order('created_at', { ascending: false });
          
          if (jobsError) throw jobsError;
          
          // Process jobs to add sharing indicators and deduplicate
          const jobsMap = new Map();
          (allJobs || []).forEach(job => {
            // Check if this job is shared (user is a collaborator but not the owner)
            const isShared = job.user_id !== user.id && 
              job.job_collaborators?.some(collab => collab.user_id === user.id);
            
            // Only add if not already in map (deduplication)
            if (!jobsMap.has(job.id)) {
              jobsMap.set(job.id, {
                ...job,
                is_shared: isShared,
                // Remove the job_collaborators relation from the final object
                job_collaborators: undefined
              });
            }
          });
          
          jobsData = Array.from(jobsMap.values());
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

  // Pagination logic
  const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
  const endIndex = startIndex + JOBS_PER_PAGE;
  const currentPageJobs = filteredJobs.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);

  // Check if all jobs on current page are selected
  const currentPageJobIds = currentPageJobs.map(job => job.id);
  const currentPageSelectedCount = selectedJobs.filter(id => currentPageJobIds.includes(id)).length;
  const isCurrentPageFullySelected = currentPageJobs.length > 0 && currentPageSelectedCount === currentPageJobs.length;

  // Bulk selection logic
  const handleSelectJob = (jobId) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleSelectAll = () => {
    if (isCurrentPageFullySelected) {
      // Deselect all jobs on current page
      const currentPageJobIds = currentPageJobs.map(job => job.id);
      setSelectedJobs(prev => prev.filter(id => !currentPageJobIds.includes(id)));
    } else {
      // Select all jobs on current page (and keep any previously selected jobs from other pages)
      const currentPageJobIds = currentPageJobs.map(job => job.id);
      setSelectedJobs(prev => [...new Set([...prev, ...currentPageJobIds])]);
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
  };

  const handleJobCreated = (newJob) => {
    setJobs((prev) => {
      // If this is replacing an optimistic job, find and replace it
      if (newJob.is_optimistic === false) {
        return prev.map(job => 
          job.is_optimistic === true && job.title === newJob.title 
            ? newJob 
            : job
        );
      }
      // Otherwise, add new job to the beginning
      return [newJob, ...prev];
    });
    
    // Only close modal if this is not an optimistic update
    if (!newJob.is_optimistic) {
      handleCloseNewJobModal();
    }
  };

  const handleJobRollback = (jobId) => {
    setJobs((prev) => prev.filter(job => job.id !== jobId));
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isCurrentPageFullySelected}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-48">Job Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-32">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-24">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-32">Pipeline</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-20">Candidates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-24">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentPageJobs.map((job) => (
                  <tr key={job.id} className={selectedJobs.includes(job.id) ? 'bg-blue-50' : ''}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(job.id)}
                        onChange={() => handleSelectJob(job.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 max-w-xs">
                        <button
                          className="text-sm font-medium text-gray-900 hover:underline truncate"
                          onClick={() => navigate(`/job/${job.id}`)}
                          title={job.title}
                        >
                          {job.title}
                        </button>
                        {job.is_optimistic && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full animate-pulse flex-shrink-0">
                            Creating...
                          </span>
                        )}
                        {job.is_shared && (
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full flex-shrink-0">
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
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="max-w-32 truncate" title={job.pipeline_id && pipelines[job.pipeline_id]?.name ? pipelines[job.pipeline_id].name : ''}>
                        {job.pipeline_id && pipelines[job.pipeline_id]?.name ? pipelines[job.pipeline_id].name : <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {candidateCounts[job.id] ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.created_at ? new Date(job.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative min-w-48">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          className="text-blue-600 hover:text-blue-900 text-xs"
                          onClick={() => handleViewPipeline(job.id)}
                        >
                          Pipeline
                        </button>
                        <div className="inline-block relative actions-menu">
                          <button 
                            className="text-gray-400 hover:text-gray-600 p-1" 
                            onClick={() => setShowActionsMenu(showActionsMenu === job.id ? null : job.id)}
                            title="More actions"
                          >
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
                      </div>
                    </td>
                  </tr>
                ))}
                {currentPageJobs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">No jobs found.</td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} results
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
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
        <NewJobModal 
          onClose={handleCloseNewJobModal}
          onJobCreated={handleJobCreated}
          onJobRollback={handleJobRollback}
        />
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