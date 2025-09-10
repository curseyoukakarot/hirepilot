import React from 'react';

interface Props {
  featureName: string;
  onClose: () => void;
}

const PremiumFeatureLockModal: React.FC<Props> = ({ featureName, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-sm rounded bg-white p-6 text-center shadow-lg">
        <button
          onClick={onClose}
          className="absolute right-2 top-2 text-gray-500"
          aria-label="Close"
        >
          &times;
        </button>
        <div className="mb-4 text-4xl">🔒</div>
        <h2 className="mb-2 text-xl font-semibold">
          Unlock {featureName} with Pro or Team
        </h2>
        <p className="mb-4 text-gray-600">
          Upgrade your plan to access this premium feature.
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="/billing"
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Billing
          </a>
          <a
            href="/pricing"
            className="rounded border border-gray-300 px-4 py-2 text-gray-700"
          >
            Pricing
          </a>
        </div>
      </div>
    </div>
  );
};

export default PremiumFeatureLockModal;
