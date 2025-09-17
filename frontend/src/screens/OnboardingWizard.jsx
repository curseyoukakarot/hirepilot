import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaArrowRight, FaRocket } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import confetti from 'canvas-confetti';

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [campaignName, setCampaignName] = useState('');
  const [jobReq, setJobReq] = useState('');
  const [messageType, setMessageType] = useState('email');
  const [messageContent, setMessageContent] = useState('');
  const [savingCampaign, setSavingCampaign] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  const updateOnboardingComplete = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) return;
    await supabase.from('users').update({ onboarding_complete: true }).eq('id', userId);
  };

  const nextStep = async () => {
    if (step === 3) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;

      await fetch('/api/sendSlackNotification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'onboarding_complete', user_email: userEmail }),
      });

      await updateOnboardingComplete();
    }

    if (step < 4) setStep(step + 1);
    else navigate('/dashboard');
  };

  const skip = () => navigate('/dashboard');

  const handleCreateCampaign = async () => {
    if (!campaignName || !jobReq) {
      alert('Please provide both a campaign name and job description.');
      return;
    }

    setSavingCampaign(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      const userEmail = user?.email;

      const response = await fetch('/api/saveCampaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, campaignName, jobReq }),
      });

      if (response.ok) {
        await fetch('/api/sendSlackNotification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: 'campaign_created', user_email: userEmail, campaign_name: campaignName }),
        });
        alert('✅ Campaign saved successfully!');
        nextStep();
      } else {
        alert('❌ Failed to save campaign.');
      }
    } catch (error) {
      console.error(error);
      alert('Error saving campaign.');
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleSaveMessage = async () => {
    if (!messageContent.trim()) {
      alert('Please enter a message.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    try {
      const response = await fetch('/api/saveMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, campaign_name: campaignName, message_type: messageType, message_text: messageContent, day: 1 }),
      });

      if (response.ok) {
        nextStep();
      } else {
        alert('Failed to save message.');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving message.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading onboarding...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="bg-white w-full max-w-xl p-8 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold">Welcome to HirePilot 🎉</h1>
          <button onClick={skip} className="text-sm text-gray-500 hover:text-gray-700">Skip for now</button>
        </div>

        {step === 0 && (
          <div className="text-center">
            <FaRocket className="text-indigo-600 text-4xl mb-4 mx-auto" />
            <h2 className="text-2xl font-bold mb-2">Welcome to HirePilot</h2>
            <p className="text-gray-600 mb-6">Let's build your first recruiting campaign — it only takes 5 minutes.</p>
            <button onClick={nextStep} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow">Start Building →</button>
          </div>
        )}

        {step === 1 && (
          <>
            <h2 className="text-lg font-medium mb-2">Step 1: Connect Your CRM</h2>
            <p className="text-gray-600 mb-6">Integrate with Clay, Apollo, or upload a CSV.</p>
            <div className="space-x-3 flex">
              <button className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200">Connect Clay</button>
              <button className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200">Upload CSV</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-medium mb-2">Step 2: Create Your First Campaign</h2>
            <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign name" className="w-full border px-3 py-2 mb-2" />
            <textarea value={jobReq} onChange={(e) => setJobReq(e.target.value)} placeholder="Job description" className="w-full border px-3 py-2 mb-2" />
            <button onClick={handleCreateCampaign} disabled={savingCampaign} className={`mt-2 px-4 py-2 rounded ${savingCampaign ? 'bg-blue-300' : 'bg-blue-600 text-white'}`}>
              {savingCampaign ? 'Saving...' : 'Save & Continue →'}
            </button>
          </>
        )}

{step === 3 && (
  <>
    <h2 className="text-lg font-medium mb-2">Step 3: Add Messaging Step</h2>
    <button
      onClick={async () => {
        try {
          const res = await fetch('/api/generate-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: campaignName,
              tone: 'Professional',
              persona: 'Recruiter',
              prompt: jobReq,
            }),
          });

          const data = await res.json();

          if (res.ok && data.message) {
            setMessageContent(data.message);
          } else {
            alert('❌ Failed to generate message.');
            console.error(data.error || 'Unknown error');
          }
        } catch (err) {
          console.error('❌ GPT Request failed:', err);
          alert('Something went wrong generating the message.');
        }
      }}
      className="bg-emerald-600 text-white px-6 py-2 rounded hover:bg-emerald-700 mb-4"
    >
      ✨ Generate with AI
    </button>
    <textarea
      value={messageContent}
      onChange={(e) => setMessageContent(e.target.value)}
      placeholder="Outreach message"
      className="w-full border px-3 py-2 mb-2"
    />
    <button onClick={handleSaveMessage} className="mt-2 bg-purple-600 text-white px-4 py-2 rounded">
      Save & Continue →
    </button>
  </>
)}


        {step > 0 && (
          <div className="mt-8 flex justify-end">
            <button onClick={nextStep} className="bg-indigo-600 text-white px-5 py-2 rounded flex items-center space-x-2 hover:bg-indigo-700">
              <span>{step < 4 ? 'Next' : 'Go to Dashboard'}</span>
              <FaArrowRight />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
