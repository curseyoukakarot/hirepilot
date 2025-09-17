import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, ArrowLeft, ArrowRight, Plus, Trash2, GripVertical, Smile, Code, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import WizardStepHeader from './WizardStepHeader';
import { useWizard } from '../../context/WizardContext';

export default function Step2Pipeline({ onBack, onNext }) {
  const { wizard, setWizard } = useWizard();
  const pipeline = wizard.pipeline;
  const campaign = wizard.campaign;

  // Tab state
  const [tab, setTab] = useState('existing');
  // Existing pipeline selection
  const [selectedPipeline, setSelectedPipeline] = useState('');
  // New pipeline form
  const [pipelineName, setPipelineName] = useState('');
  const [department, setDepartment] = useState('');
  const [stages, setStages] = useState([
    { name: 'Initial Screening', icon: 'smile' },
    { name: 'Technical Interview', icon: 'code' },
    { name: 'Final Interview', icon: 'users' },
  ]);
  const [existingPipelines, setExistingPipelines] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch existing pipelines
  useEffect(() => {
    const fetchPipelines = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('User not authenticated');
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/pipelines?user_id=${session.user.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch pipelines');
        
        const data = await response.json();
        setExistingPipelines(data.pipelines || []);
      } catch (err) {
        console.error('Error fetching pipelines:', err);
        setError(err.message);
      }
    };

    fetchPipelines();
  }, []);

  // Stage icon mapping
  const getIcon = (icon) => {
    if (icon === 'smile') return <Smile className="text-blue-600" />;
    if (icon === 'code') return <Code className="text-green-600" />;
    if (icon === 'users') return <Users className="text-purple-600" />;
    return <Smile />;
  };
  const getBg = (icon) => {
    if (icon === 'smile') return 'bg-blue-100';
    if (icon === 'code') return 'bg-green-100';
    if (icon === 'users') return 'bg-purple-100';
    return 'bg-gray-100';
  };
  const getPreviewBg = (icon) => {
    if (icon === 'smile') return 'bg-blue-50 border-blue-100';
    if (icon === 'code') return 'bg-green-50 border-green-100';
    if (icon === 'users') return 'bg-purple-50 border-purple-100';
    return 'bg-gray-50 border-gray-100';
  };

  // Stage editing
  const handleStageNameChange = (idx, value) => {
    setStages(stages.map((s, i) => i === idx ? { ...s, name: value } : s));
  };
  const handleRemoveStage = (idx) => {
    setStages(stages.filter((_, i) => i !== idx));
  };
  const handleAddStage = () => {
    const icons = ['smile', 'code', 'users'];
    setStages([...stages, { name: '', icon: icons[stages.length % icons.length] }]);
  };

  const handleSavePipeline = async () => {
    if (!canProceed) return;

    setIsLoading(true);
    setError(null);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('User not authenticated');

      if (tab === 'existing') {
        const selected = existingPipelines.find(p => p.id === selectedPipeline);
        if (!selected) throw new Error('Selected pipeline not found');
        setWizard(prev => ({ ...prev, pipeline: selected }));
      } else {
        // Create new pipeline
        let data;
        try {
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/pipelines`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            credentials: 'include',
            body: JSON.stringify({
              user_id: session.user.id,
              name: pipelineName,
              department,
              stages
            }),
          });

          if (!response.ok) {
            // Try to parse error as JSON, else show raw text
            try {
              data = await response.json();
              throw new Error(data.error || 'Failed to create pipeline');
            } catch (jsonErr) {
              const text = await response.text();
              console.error('Pipeline creation failed, non-JSON response:', text);
              throw new Error('Pipeline creation failed: ' + text);
            }
          }

          // Try to parse success as JSON, else show raw text
          try {
            data = await response.json();
          } catch (jsonErr) {
            const text = await response.text();
            console.error('Pipeline creation succeeded, but non-JSON response:', text);
            throw new Error('Pipeline creation succeeded, but response was not valid JSON.');
          }
        } catch (err) {
          setError(err.message);
          return;
        }
        const { pipeline: newPipeline } = data;
        setWizard(prev => ({ ...prev, pipeline: newPipeline }));
      }

      onNext();
    } catch (err) {
      console.error('Error saving pipeline:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = (tab === 'existing' && selectedPipeline) || 
                    (tab === 'new' && pipelineName && department && stages.length > 0 && 
                     stages.every(s => s.name.trim().length > 0));

  return (
    <div className="min-h-screen bg-base-50 text-base-content">
      {/* Header */}
      <WizardStepHeader currentStep={2} />
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pb-12">
        {/* Job Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Campaign Summary</h2>
          <h3 className="text-lg font-semibold mb-2">{campaign?.title || 'Untitled Campaign'}</h3>
          <div className="flex gap-2">
            {campaign?.keywords?.split(',').map((keyword, index) => (
              <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                {keyword.trim()}
              </span>
            ))}
          </div>
        </div>
        {/* Pipeline Selection */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              className={`px-4 py-2 rounded-md ${tab === 'existing' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700'}`}
              onClick={() => setTab('existing')}
            >
              Use Existing Pipeline
            </button>
            <button
              className={`px-4 py-2 rounded-md ${tab === 'new' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700'}`}
              onClick={() => setTab('new')}
            >
              Create New Pipeline
            </button>
          </div>
          {/* Existing Pipeline Section */}
          {tab === 'existing' && (
            <div className="mb-8">
              <div className="relative">
                <select
                  className="w-full border border-gray-300 rounded-md px-4 py-2 appearance-none bg-white"
                  value={selectedPipeline}
                  onChange={e => setSelectedPipeline(e.target.value)}
                >
                  <option value="">Select Existing Pipeline</option>
                  {existingPipelines.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-3 text-gray-400 pointer-events-none">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}
          {/* New Pipeline Section */}
          {tab === 'new' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline Name</label>
                <input
                  type="text"
                  placeholder="e.g., Senior React Dev – NYC"
                  className="w-full border border-gray-300 rounded-md px-4 py-2"
                  value={pipelineName}
                  onChange={e => setPipelineName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <div className="relative">
                  <select
                    className="w-full border border-gray-300 rounded-md px-4 py-2 appearance-none bg-white"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                  >
                    <option value="">Select Department</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Sales">Sales</option>
                    <option value="Product">Product</option>
                    <option value="Marketing">Marketing</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                  </select>
                  <div className="absolute right-3 top-3 text-gray-400 pointer-events-none">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
              {/* Pipeline Stages */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Pipeline Stages</label>
                <div className="space-y-3">
                  {stages.map((stage, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <GripVertical className="text-gray-400" />
                      <input
                        type="text"
                        value={stage.name}
                        onChange={e => handleStageNameChange(idx, e.target.value)}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-1.5"
                      />
                      <div className={`w-8 h-8 rounded flex items-center justify-center ${getBg(stage.icon)}`}>
                        {getIcon(stage.icon)}
                      </div>
                      <button className="text-gray-400 hover:text-red-500" onClick={() => handleRemoveStage(idx)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2"
                    onClick={handleAddStage}
                  >
                    <Plus className="w-4 h-4" />
                    Add Stage
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Visual Preview */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Pipeline Preview</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {stages.map((stage, idx) => (
              <div key={idx} className={`flex-shrink-0 w-48 p-3 rounded-lg border ${getPreviewBg(stage.icon)}`}>
                <div className="flex items-center gap-2 mb-2">
                  {getIcon(stage.icon)}
                  <span className="text-sm font-medium">{stage.name || 'Stage'}</span>
                </div>
                <div className="text-xs text-gray-500">0 candidates</div>
              </div>
            ))}
          </div>
        </div>
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}
      </main>

      {/* Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <button 
              className="flex items-center text-gray-600 hover:text-gray-900" 
              onClick={onBack}
            >
              <ArrowLeft className="mr-2 w-5 h-5" />
              Back
            </button>
            <button 
              className={`bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                !canProceed || isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={handleSavePipeline}
              disabled={!canProceed || isLoading}
            >
              {isLoading ? 'Saving...' : 'Next: Message'}
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
} 