import React, { useState } from "react";
import { supabase } from "../lib/supabase";

interface NewJobModalProps {
  onClose: () => void;
  onJobCreated?: (job: any) => void;
}

export default function NewJobModal({ onClose, onJobCreated }: NewJobModalProps) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("open");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [salaryRange, setSalaryRange] = useState("");
  const [stages, setStages] = useState([
    "Sourced",
    "Contacted", 
    "Interviewed",
    "Offered",
    "Hired"
  ]);
  const [isCreating, setIsCreating] = useState(false);

  const addStage = () => setStages([...stages, ""]);
  
  const updateStage = (i: number, value: string) => {
    const next = [...stages];
    next[i] = value;
    setStages(next);
  };

  const removeStage = (i: number) => {
    if (stages.length > 1) {
      const next = stages.filter((_, index) => index !== i);
      setStages(next);
    }
  };

  const handleCreateJob = async () => {
    if (!title.trim()) {
      alert('Job title is required');
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const base = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
      
      // Create job first
      const jobResponse = await fetch(`${base}/api/jobs/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          department: department.trim(),
          status: status,
          description: description.trim(),
          location: location.trim(),
          salary_range: salaryRange.trim()
        })
      });

      if (!jobResponse.ok) {
        const error = await jobResponse.json();
        throw new Error(error.error || 'Failed to create job');
      }

      const jobResult = await jobResponse.json();
      const jobId = jobResult.jobId || jobResult.job?.id;

      if (!jobId) {
        throw new Error('Job created but no ID returned');
      }

      // Create pipeline with custom stages
      const pipelineResponse = await fetch(`${base}/api/jobs/${jobId}/pipeline`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stages: stages.filter(s => s.trim()) }),
      });

      if (!pipelineResponse.ok) {
        const error = await pipelineResponse.json();
        console.warn('Pipeline creation failed:', error);
        // Don't fail the job creation, just warn
      }

      // Call the callback if provided
      if (onJobCreated) {
        onJobCreated(jobResult.job || { id: jobId, title, department, status });
      }

      onClose();
    } catch (err: any) {
      console.error('Job creation error:', err);
      alert('Failed to create job: ' + (err.message || err));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Create New Job</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Senior Software Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                placeholder="e.g. Engineering"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select 
                value={status} 
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="open">Open</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              placeholder="Job description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                placeholder="e.g. San Francisco, CA"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salary Range
              </label>
              <input
                type="text"
                placeholder="e.g. $80,000 - $120,000"
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Pipeline Stages</h3>
            <p className="text-sm text-gray-600 mb-3">
              Customize the stages for this job's pipeline. You can add, remove, or reorder stages.
            </p>
            
            <div className="space-y-2">
              {stages.map((stage, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={stage}
                    onChange={(e) => updateStage(i, e.target.value)}
                    placeholder={`Stage ${i + 1}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {stages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStage(i)}
                      className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <button
              type="button"
              onClick={addStage}
              className="mt-2 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
            >
              + Add Stage
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateJob}
            disabled={isCreating || !title.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </div>
    </div>
  );
}
