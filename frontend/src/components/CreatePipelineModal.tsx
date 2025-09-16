import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

interface CreatePipelineModalProps {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
  onPipelineCreated: (pipelineId: string) => void;
}

export default function CreatePipelineModal({ 
  jobId, 
  jobTitle, 
  onClose, 
  onPipelineCreated 
}: CreatePipelineModalProps) {
  const [name, setName] = useState(`${jobTitle} Pipeline`);
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

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('❌ Pipeline name is required');
      return;
    }

    if (stages.filter(s => s.trim()).length === 0) {
      toast.error('❌ At least one stage is required');
      return;
    }

    setIsCreating(true);
    const loadingToast = toast.loading('🔄 Creating pipeline and stages...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const base = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
      
      // Create pipeline with custom stages using the API endpoint
      const response = await fetch(`${base}/api/jobs/${jobId}/pipeline`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          stages: stages.filter(s => s.trim()),
          name: name.trim()
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create pipeline');
      }

      const result = await response.json();
      
      toast.dismiss(loadingToast);
      toast.success(`✅ Pipeline "${name}" created and stages set!`);
      
      onPipelineCreated(result.pipeline_id);
      onClose();
    } catch (err: any) {
      console.error('Pipeline creation error:', err);
      toast.dismiss(loadingToast);
      toast.error(`❌ Error: ${err.message || 'Failed to create pipeline'}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Create New Pipeline</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pipeline Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Senior Software Engineer Pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Pipeline Stages</h3>
            <p className="text-sm text-gray-600 mb-3">
              Customize the stages for this pipeline. You can add, remove, or reorder stages.
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
            onClick={handleSave}
            disabled={isCreating || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Pipeline'}
          </button>
        </div>
      </div>
    </div>
  );
}
