import React from 'react';
import { FileText, GitBranch, MessageSquare, Users, Check } from 'lucide-react';

const steps = [
  { label: 'Job Description', icon: FileText },
  { label: 'Pipeline', icon: GitBranch },
  { label: 'Message', icon: MessageSquare },
  { label: 'Leads', icon: Users },
  { label: 'Review', icon: Check },
];

export default function WizardStepHeader({ currentStep = 1 }) {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center w-full">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === idx + 1;
            const isCompleted = currentStep > idx + 1;
            return (
              <React.Fragment key={step.label}>
                <div className="relative flex flex-col items-center">
                  <div
                    className={
                      isActive
                        ? 'w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white'
                        : isCompleted
                        ? 'w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white'
                        : 'w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500'
                    }
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div
                    className={
                      isActive
                        ? 'text-sm mt-2 font-medium text-blue-600'
                        : isCompleted
                        ? 'text-sm mt-2 font-medium text-green-600'
                        : 'text-sm mt-2 font-medium text-gray-500'
                    }
                  >
                    {step.label}
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={
                      isCompleted
                        ? 'flex-1 h-1 mx-4 bg-green-200'
                        : isActive
                        ? 'flex-1 h-1 mx-4 bg-blue-200'
                        : 'flex-1 h-1 mx-4 bg-gray-200'
                    }
                  ></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
} 