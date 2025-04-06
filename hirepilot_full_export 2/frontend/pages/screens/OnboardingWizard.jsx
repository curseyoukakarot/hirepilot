import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaArrowRight } from 'react-icons/fa';

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const nextStep = () => {
    if (step < 4) setStep(step + 1);
    else {
      // Final step: redirect to dashboard
      navigate('/dashboard');
    }
  };

  const skip = () => {
    // User skips onboarding
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="bg-white w-full max-w-xl p-8 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-gray-800">Welcome to HirePilot 🎉</h1>
          <button onClick={skip} className="text-sm text-gray-500 hover:text-gray-700">Skip for now</button>
        </div>

        {step === 1 && (
          <>
            <h2 className="text-lg font-medium mb-2">Step 1: Connect Your CRM</h2>
            <p className="text-gray-600 mb-6">Integrate with Clay, Apollo, or your CSV to start pulling leads automatically.</p>
            <div className="space-x-3 flex">
              <button className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200">Connect Clay</button>
              <button className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200">Upload CSV</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-medium mb-2">Step 2: Setup Your First Campaign</h2>
            <p className="text-gray-600 mb-6">Create a sourcing campaign for your open job requisition.</p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">Create Campaign</button>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-medium mb-2">Step 3: Add Messaging Steps</h2>
            <p className="text-gray-600 mb-6">Setup emails, LinkedIn, and Slack steps powered by GPT.</p>
            <button className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700">Launch GPT Editor</button>
          </>
        )}

        {step === 4 && (
          <>
            <div className="flex flex-col items-center text-center">
              <FaCheckCircle className="text-green-500 text-4xl mb-4" />
              <h2 className="text-xl font-semibold">You're all set!</h2>
              <p className="text-gray-600 mt-2">Let’s head to your dashboard to start sourcing.</p>
            </div>
          </>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={nextStep}
            className="bg-indigo-600 text-white px-5 py-2 rounded flex items-center space-x-2 hover:bg-indigo-700"
          >
            <span>{step < 4 ? 'Next' : 'Go to Dashboard'}</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}
