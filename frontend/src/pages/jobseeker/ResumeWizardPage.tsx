import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaBullseye,
  FaCheck,
  FaClock,
  FaCloudArrowUp,
  FaFilePdf,
  FaLinkedin,
  FaRobot,
  FaSpinner,
  FaWandMagicSparkles,
} from 'react-icons/fa6';
import { supabase } from '../../lib/supabaseClient';

type ChecklistState = 'idle' | 'active' | 'done';
type Draft = { id: string };

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  return headers;
}

export default function ResumeWizardPage() {
  const navigate = useNavigate();
  const backend = import.meta.env.VITE_BACKEND_URL || '';

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [linkedinFileName, setLinkedinFileName] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadingLinkedIn, setUploadingLinkedIn] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Array<{ label: string; state: ChecklistState }>>([
    { label: 'Extracting text…', state: 'idle' },
    { label: 'Analyzing roles…', state: 'idle' },
    { label: 'Writing bullets…', state: 'idle' },
    { label: 'Building summary + skills…', state: 'idle' },
    { label: 'Preparing your builder…', state: 'idle' },
  ]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const linkedinInputRef = useRef<HTMLInputElement | null>(null);

  const progressLabel = useMemo(() => `Step ${currentStep} of 3`, [currentStep]);

  const setChecklistState = (index: number, state: ChecklistState) => {
    setChecklist((prev) => prev.map((item, i) => (i === index ? { ...item, state } : item)));
  };

  const uploadResume = useCallback(
    async (file: File) => {
      setError(null);
      setUploadingResume(true);
      try {
        const headers = await authHeaders();
        const form = new FormData();
        form.append('resume', file);
        const res = await fetch(`${backend}/api/jobs/resume-drafts`, {
          method: 'POST',
          headers,
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'upload_failed');
        const draft = data?.draft as Draft | undefined;
        if (!draft?.id) throw new Error('draft_missing');
        setDraftId(draft.id);
        setResumeFileName(file.name);
      } catch (e: any) {
        setError(e?.message || 'Upload failed');
      } finally {
        setUploadingResume(false);
      }
    },
    [backend]
  );

  const uploadLinkedIn = useCallback(
    async (file: File) => {
      if (!draftId) return;
      setError(null);
      setUploadingLinkedIn(true);
      try {
        const headers = await authHeaders();
        const form = new FormData();
        form.append('file', file);
        form.append('type', 'linkedin');
        const res = await fetch(`${backend}/api/jobs/resume-drafts/${draftId}/upload`, {
          method: 'POST',
          headers,
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'upload_failed');
        setLinkedinFileName(file.name);
      } catch (e: any) {
        setError(e?.message || 'LinkedIn upload failed');
      } finally {
        setUploadingLinkedIn(false);
      }
    },
    [backend, draftId]
  );

  const handleResumeFile = (file: File | null) => {
    if (!file) return;
    uploadResume(file);
  };

  const handleLinkedInFile = (file: File | null) => {
    if (!file) return;
    uploadLinkedIn(file);
  };

  const goToStep2 = () => {
    if (!resumeFileName || uploadingResume) return;
    setCurrentStep(2);
  };

  const goToStep3 = () => {
    setCurrentStep(3);
  };

  const runGenerate = async () => {
    if (!draftId) {
      setError('Upload your resume first.');
      return;
    }
    setGenerating(true);
    setStatusMessage(null);
    setChecklist((prev) => prev.map((c, idx) => ({ ...c, state: idx === 0 ? 'active' : 'idle' })));
    try {
      // Extract
      const headers = await authHeaders();
      const extractRes = await fetch(`${backend}/api/jobs/resume-drafts/${draftId}/extract`, {
        method: 'POST',
        headers,
      });
      const extractData = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractData?.error || 'extract_failed');
      setChecklistState(0, 'done');
      setChecklistState(1, 'active');

      // Generate
      const genRes = await fetch(`${backend}/api/jobs/resume-drafts/${draftId}/generate`, {
        method: 'POST',
        headers,
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData?.error || 'generate_failed');
      setChecklistState(1, 'done');
      setChecklistState(2, 'done');
      setChecklistState(3, 'done');
      setChecklistState(4, 'done');
      setStatusMessage('Opening builder…');
      setTimeout(() => {
        navigate(`/prep/resume/builder?draftId=${draftId}`);
      }, 600);
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
      setChecklist((prev) => prev.map((c) => ({ ...c, state: c.state === 'active' ? 'idle' : c.state })));
    } finally {
      setGenerating(false);
    }
  };

  const StepSidebar = (
    <div id="sidebar" className="w-80 bg-[#1e293b] border-r border-[#334155] p-8">
      <div id="logo" className="mb-12">
        <h1 className="text-2xl font-bold text-white">HirePilot</h1>
        <p className="text-gray-400 text-sm mt-1">Resume Builder</p>
      </div>

      <div id="progress" className="mb-8">
        <div className="bg-[#6366f1]/20 text-[#6366f1] text-sm px-3 py-1 rounded-full inline-block mb-6">
          {progressLabel}
        </div>

        <div className="space-y-6">
          {[
            { id: 1, title: 'Upload Resume', desc: 'Upload your current resume for analysis' },
            { id: 2, title: 'LinkedIn Profile', desc: 'Optional LinkedIn PDF for better results' },
            { id: 3, title: 'Generate Resume', desc: 'REX creates your optimized resume' },
          ].map((step) => {
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;
            const muted = !isActive && !isDone;
            const circleClass = isActive || isDone ? 'bg-[#6366f1] text-white' : 'bg-[#334155] text-gray-400';
            const titleClass = isActive || isDone ? 'text-white' : 'text-gray-400';
            const descClass = isActive || isDone ? 'text-gray-400' : 'text-gray-500';
            return (
              <div
                key={step.id}
                id={`step-${step.id}`}
                className={`flex items-start space-x-3 ${muted ? 'opacity-50' : ''} ${isActive ? 'drop-shadow-[0_0_12px_rgba(99,102,241,0.25)]' : ''}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mt-1 ${circleClass}`}>
                  {step.id}
                </div>
                <div>
                  <h3 className={`font-medium ${titleClass}`}>{step.title}</h3>
                  <p className={`${descClass} text-sm mt-1`}>{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div id="features" className="space-y-4">
        <div className="flex items-center space-x-3 text-gray-300">
          <FaWandMagicSparkles className="text-[#6366f1]" />
          <span className="text-sm">AI-powered content optimization</span>
        </div>
        <div className="flex items-center space-x-3 text-gray-300">
          <FaBullseye className="text-[#6366f1]" />
          <span className="text-sm">Impact-focused bullet points</span>
        </div>
        <div className="flex items-center space-x-3 text-gray-300">
          <FaClock className="text-[#6366f1]" />
          <span className="text-sm">3-minute setup</span>
        </div>
      </div>
    </div>
  );

  const UploadZone = ({
    onClick,
    icon,
    title,
    helper,
    disabled,
  }: {
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
    helper: string;
    disabled?: boolean;
  }) => (
    <div
      id="upload-zone"
      className="bg-[#1e293b] border-2 border-dashed border-[#334155] rounded-lg p-12 mb-8 hover:border-[#6366f1]/50 transition-colors cursor-pointer"
      onClick={disabled ? undefined : onClick}
    >
      <div className="text-center">
        <div className="text-6xl text-gray-500 mb-6 flex justify-center">{icon}</div>
        <h3 className="text-xl font-medium text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-6">or</p>
        <button
          className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-6 py-3 rounded-lg font-medium transition-colors"
          disabled={disabled}
        >
          Choose file
        </button>
        <p className="text-gray-500 text-sm mt-4">{helper}</p>
      </div>
    </div>
  );

  const UploadSuccess = ({
    name,
    onReplace,
    isLinkedIn,
  }: {
    name: string;
    onReplace: () => void;
    isLinkedIn?: boolean;
  }) => (
    <div className="bg-[#1e293b] border border-green-500/30 rounded-lg p-6 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FaFilePdf className="text-green-500 text-xl" />
          <div>
            <p className="text-white font-medium">{name}</p>
            <p className="text-gray-400 text-sm">{isLinkedIn ? 'LinkedIn PDF uploaded' : 'Uploaded successfully'}</p>
          </div>
        </div>
        <button className="text-[#6366f1] hover:text-[#4f46e5] font-medium" onClick={onReplace}>
          Replace
        </button>
      </div>
    </div>
  );

  const Step1 = (
    <div id="step-1-content" className={currentStep === 1 ? 'text-center' : 'hidden'}>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Upload your resume</h1>
        <p className="text-gray-400 text-lg">PDF works best. We&apos;ll extract your experience automatically.</p>
      </div>

      {!resumeFileName ? (
        <UploadZone
          onClick={() => fileInputRef.current?.click()}
          icon={<FaCloudArrowUp />}
          title="Drag and drop your resume here"
          helper="Supports PDF, DOC, DOCX (Max 10MB)"
          disabled={uploadingResume}
        />
      ) : (
        <UploadSuccess name={resumeFileName} onReplace={() => fileInputRef.current?.click()} />
      )}

      <button
        id="continue-btn"
        onClick={goToStep2}
        disabled={!resumeFileName || uploadingResume}
        className={`w-full py-4 rounded-lg font-medium transition ${
          resumeFileName
            ? 'bg-[#6366f1] hover:bg-[#4f46e5] text-white cursor-pointer'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
      >
        {uploadingResume ? 'Uploading…' : 'Continue'}
      </button>
    </div>
  );

  const Step2 = (
    <div id="step-2-content" className={currentStep === 2 ? 'text-center' : 'hidden'}>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Upload your LinkedIn profile</h1>
        <p className="text-gray-400 text-lg mb-2">Optional, but recommended for better results</p>
        <p className="text-gray-500 text-sm">Export as PDF from LinkedIn → &quot;More&quot; → &quot;Save to PDF&quot;</p>
      </div>

      {!linkedinFileName ? (
        <UploadZone
          onClick={() => linkedinInputRef.current?.click()}
          icon={<FaLinkedin className="text-blue-500" />}
          title="Drag and drop your LinkedIn PDF here"
          helper="LinkedIn PDF upload"
          disabled={uploadingLinkedIn}
        />
      ) : (
        <UploadSuccess name={linkedinFileName} onReplace={() => linkedinInputRef.current?.click()} isLinkedIn />
      )}

      <div className="flex space-x-4">
        <button
          id="skip-btn"
          onClick={goToStep3}
          className="flex-1 bg-transparent border border-[#334155] text-gray-300 py-4 rounded-lg font-medium hover:bg-[#334155] transition-colors"
        >
          Skip for now
        </button>
        <button
          id="continue-step2-btn"
          onClick={goToStep3}
          className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white py-4 rounded-lg font-medium transition-colors"
          disabled={uploadingLinkedIn}
        >
          {uploadingLinkedIn ? 'Uploading…' : 'Continue'}
        </button>
      </div>
    </div>
  );

  const Step3 = (
    <div id="step-3-content" className={currentStep === 3 && !generating ? 'text-center' : 'hidden'}>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">One click. New resume.</h1>
        <p className="text-gray-400 text-lg">REX rewrites each role based on why you were hired + measurable impact.</p>
      </div>

      <div className="bg-[#1e293b] rounded-lg p-8 mb-8">
        <div className="flex items-center justify-center mb-6">
          <FaRobot className="text-[#6366f1] text-5xl" />
        </div>
        <h3 className="text-xl font-medium text-white mb-4">REX AI Resume Engine</h3>
        <ul className="text-gray-300 space-y-2 text-left max-w-md mx-auto">
          <li className="flex items-center space-x-2">
            <FaCheck className="text-green-500" />
            <span>Analyzes your experience</span>
          </li>
          <li className="flex items-center space-x-2">
            <FaCheck className="text-green-500" />
            <span>Quantifies achievements</span>
          </li>
          <li className="flex items-center space-x-2">
            <FaCheck className="text-green-500" />
            <span>Optimizes for impact</span>
          </li>
        </ul>
      </div>

      <div className="flex space-x-4">
        <button
          id="back-btn"
          onClick={() => setCurrentStep(2)}
          className="flex-1 bg-transparent border border-[#334155] text-gray-300 py-4 rounded-lg font-medium hover:bg-[#334155] transition-colors"
        >
          Back
        </button>
        <button
          id="generate-btn"
          onClick={runGenerate}
          className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white py-4 rounded-lg font-medium transition-colors"
          disabled={generating}
        >
          {generating ? 'Generating…' : 'Generate resume with REX'}
        </button>
      </div>
    </div>
  );

  const GeneratingState = (
    <div id="generating-content" className={generating ? 'text-center' : 'hidden'}>
      <div className="mb-8">
        <div className="w-16 h-16 bg-[#6366f1] rounded-full flex items-center justify-center mx-auto mb-6">
          <FaSpinner className="text-white text-2xl animate-spin" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">Generating your resume...</h1>
        <p className="text-gray-400 text-lg">REX is analyzing and optimizing your content</p>
      </div>

      <div className="bg-[#1e293b] rounded-lg p-8">
        <div className="space-y-4">
          {checklist.map((item, idx) => (
            <div key={item.label} className="flex items-center space-x-3">
              {item.state === 'done' ? (
                <FaCheck className="text-green-500" />
              ) : item.state === 'active' ? (
                <div className="w-4 h-4 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="w-4 h-4 border-2 border-gray-500 rounded-full" />
              )}
              <span className={item.state === 'active' ? 'text-white' : item.state === 'done' ? 'text-gray-300' : 'text-gray-500'}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {statusMessage && <p className="text-gray-300 mt-4">{statusMessage}</p>}
    </div>
  );

  return (
    <div className="bg-[#0f172a] text-white font-sans min-h-screen">
      <style>{'::-webkit-scrollbar { display: none; }'}</style>
      <div id="wizard-container" className="min-h-screen flex">
        {StepSidebar}

        <div id="main-content" className="flex-1 flex items-center justify-center p-8">
          <div id="upload-card" className="w-full max-w-2xl">
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {Step1}
            {Step2}
            {Step3}
            {GeneratingState}
          </div>
        </div>
      </div>

      {/* Hidden inputs for file selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => handleResumeFile(e.target.files?.[0] || null)}
      />
      <input
        ref={linkedinInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => handleLinkedInFile(e.target.files?.[0] || null)}
      />
    </div>
  );
}

