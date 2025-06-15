import React from 'react';
import { useGoLive } from '../hooks/useGoLive';

interface GoLiveButtonProps {
  campaignId: string;
  onComplete?: () => void;
}

export function GoLiveButton({ campaignId, onComplete }: GoLiveButtonProps) {
  const { goLive, isLoading, error, progress } = useGoLive(campaignId, {
    onSuccess: onComplete,
    onError: (error) => {
      // You can add a toast notification here
      console.error('Go live failed:', error);
    }
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={goLive}
        disabled={isLoading}
        className={`
          px-4 py-2 rounded-md font-medium
          ${isLoading 
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        {isLoading ? 'Enriching...' : 'Go Live'}
      </button>

      {isLoading && (
        <div className="w-full max-w-xs">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-1 text-center">
            {progress}% Complete
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-1">
          {error.message}
        </p>
      )}
    </div>
  );
} 