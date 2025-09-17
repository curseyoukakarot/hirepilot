import React, { useState } from 'react';
import { Clipboard, Upload, Wand2, X, FileText, GitBranch, MessageSquare, Users, Check, Lightbulb, ArrowLeft, ArrowRight, HelpCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import WizardStepHeader from './WizardStepHeader';
import { useWizard } from '../../context/WizardContext';

// Mock UI components for now
const Button = ({ children, className = '', ...props }) => (
  <button className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 ${className}`} {...props}>
    {children}
  </button>
);

const Input = ({ className = '', ...props }) => (
  <input className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`} {...props} />
);

const Textarea = ({ className = '', ...props }) => (
  <textarea className={`w-full p-4 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`} {...props} />
);

export default function Step1JobDescription({ onNext, onBack }) {
  const { setWizard } = useWizard();
  const [campaignName, setCampaignName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [skipEnabled, setSkipEnabled] = useState(false);

  // Handlers
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJobDescription(text);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setJobDescription(evt.target.result);
    };
    reader.readAsText(file);
  };

  const handleGenerateKeywords = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      });
      const data = await response.json();
      if (response.ok && data.keywords) {
        setKeywords(data.keywords);
      } else {
        throw new Error(data.error || 'Failed to generate keywords');
      }
    } catch (err) {
      console.error('Error generating keywords:', err);
      // Fallback to mock data
      setKeywords(["React.js", "TypeScript", "Frontend"]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (kw) => {
    setKeywords(keywords.filter(k => k !== kw));
  };

  const handleSaveCampaign = async () => {
    if (!canProceed) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/saveCampaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          campaignName,
          jobReq: jobDescription,
          keywords: keywords.join(', '),
          status: 'draft'
        }),
      });

      let data;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        console.error('Non-JSON response from backend:', text);
        throw new Error('Server error: ' + text);
      }

      if (!response.ok) {
        console.error('Backend error response:', text);
        throw new Error(data.error || 'Failed to save campaign');
      }

      console.log('[Step1] Campaign saved:', data);
      console.log('[Step1] wizard after save', data.campaign?.id);

      // Store campaign row and id directly in wizard context
      setWizard(prev => ({
        ...prev,
        campaign: data.campaign,
        campaignId: data.campaign?.id,
        job: jobDescription,
        keywords: keywords.join(', '),
      }));

      onNext();
    } catch (err) {
      console.error('Error saving campaign:', err);
      alert(err.message || 'Failed to save campaign. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasName = campaignName.trim().length > 0;
  const canProceed = hasName && jobDescription.trim().length > 0 && keywords.length > 0;

  const handleSkip = async () => {
    if (!hasName || isSaving) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/saveCampaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          campaignName,
          jobReq: '',
          keywords: '',
          status: 'draft'
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save campaign');

      setWizard(prev => ({ ...prev, campaign: data.campaign, campaignId: data.campaign?.id, job: '', keywords: '' }));
      onNext();
    } catch (e) {
      alert(e.message || 'Failed to create campaign');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Progress Tracker */}
      <WizardStepHeader currentStep={1} />

      {/* Campaign Title */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Name</label>
        <Input
          type="text"
          placeholder="e.g., Senior Frontend Engineer – NYC"
          value={campaignName}
          onChange={e => setCampaignName(e.target.value)}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Job Description</h2>
            <div className="flex space-x-3">
              <Button className="border border-gray-200 hover:bg-gray-50" onClick={handlePaste}>
                <Clipboard className="w-4 h-4" />
                Paste
              </Button>
              <label>
                <input type="file" accept=".txt,.md,.docx" className="hidden" onChange={handleUpload} />
                <Button className="border border-gray-200 hover:bg-gray-50">
                  <Upload className="w-4 h-4" />
                  Upload
                </Button>
              </label>
            </div>
          </div>
          
          <Textarea
            rows={20}
            placeholder="Enter or paste job description here..."
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
          />
          
          <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Use Sample JD
          </button>
        </div>

        {/* Right Panel */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Keywords</h2>
            <div className="flex items-center gap-2">
              <Button 
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleGenerateKeywords}
                disabled={isGenerating}
              >
                <Wand2 className="w-4 h-4" />
                {isGenerating ? 'Generating...' : 'Generate Keywords'}
              </Button>
              <div className="relative group">
                <HelpCircle className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" />
                <div className="absolute right-0 w-64 p-3 bg-gray-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  Uses AI to extract relevant skills, titles, and industry terms from your job description.
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-[200px] p-4 border border-gray-200 rounded-lg mb-4">
            <div className="flex flex-wrap gap-2">
              {keywords.map(kw => (
                <span key={kw} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full flex items-center gap-2">
                  {kw}
                  <button 
                    className="hover:text-blue-900"
                    onClick={() => handleRemoveKeyword(kw)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="+ Add keyword"
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); } }}
            />
            <Button 
              className="text-white bg-blue-600 hover:bg-blue-700"
              onClick={handleAddKeyword}
              disabled={!keywordInput.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      </div>

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
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={skipEnabled} onChange={(e)=> setSkipEnabled(e.target.checked)} />
                Skip (tie to existing job later)
              </label>
              <button 
              className={`bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                !canProceed || isSaving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={handleSaveCampaign}
              disabled={!canProceed || isSaving}
            >
              {isSaving ? 'Saving...' : 'Next: Pipeline'}
              <ArrowRight className="ml-2 w-5 h-5" />
              </button>
              <button
                className={`px-6 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${!hasName || !skipEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleSkip}
                disabled={!hasName || !skipEnabled || isSaving}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 