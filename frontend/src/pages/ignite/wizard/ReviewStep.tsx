import React from 'react';

type ReviewStepProps = {
  onBack: () => void;
  onNext: () => void;
};

function Accordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-lg border border-gray-200">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-gray-900 hover:bg-gray-50"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <i className={`fa-solid ${open ? 'fa-chevron-up' : 'fa-chevron-down'} text-gray-400`} />
      </button>
      {open && <div className="border-t border-gray-200 px-4 py-3 text-sm text-gray-600">{children}</div>}
    </div>
  );
}

export default function ReviewStep({ onBack, onNext }: ReviewStepProps) {
  const [tab, setTab] = React.useState<'internal' | 'client'>('internal');

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900">Step 4: Review</h2>
        <p className="mt-1 text-gray-600">Review internal calculations and client presentation</p>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            type="button"
            onClick={() => setTab('internal')}
            className={`px-6 py-4 text-sm font-medium ${
              tab === 'internal'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <i className="fa-solid fa-calculator mr-2" />
            Internal Review
          </button>
          <button
            type="button"
            onClick={() => setTab('client')}
            className={`px-6 py-4 text-sm font-medium ${
              tab === 'client'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <i className="fa-solid fa-file-invoice mr-2" />
            Client Preview
          </button>
        </div>
      </div>

      {tab === 'internal' ? (
        <div className="p-6">
          <div className="mb-8 grid grid-cols-4 gap-4">
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="mb-1 text-sm font-medium text-blue-600">Total Investment</div>
              <div className="text-2xl font-bold text-blue-700">$26,172.10</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="mb-1 text-sm font-medium text-gray-600">Costs Subtotal</div>
              <div className="text-2xl font-bold text-gray-900">$21,890.51</div>
            </div>
            <div className="rounded-lg bg-green-50 p-4">
              <div className="mb-1 text-sm font-medium text-green-600">Ignite Fee (20%)</div>
              <div className="text-2xl font-bold text-green-700">$4,378.10</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-4">
              <div className="mb-1 text-sm font-medium text-purple-600">Contingency (0%)</div>
              <div className="text-2xl font-bold text-purple-700">$0.00</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Category Breakdown</h3>
              <div className="space-y-3">
                {[
                  ['bg-blue-500', 'Venue', '$6,696.25'],
                  ['bg-green-500', 'F&B', '$11,383.63'],
                  ['bg-purple-500', 'Production Fees', '$3,810.63'],
                  ['bg-orange-500', 'Travel', '$0.00'],
                ].map(([colorClass, label, amount]) => (
                  <div key={label} className="flex items-center justify-between border-b border-gray-100 py-3">
                    <div className="flex items-center space-x-3">
                      <div className={`h-3 w-3 rounded-full ${colorClass}`} />
                      <span className="font-medium text-gray-900">{label}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Audit</h3>
              <div className="space-y-4">
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="mb-2 flex items-center space-x-2">
                    <i className="fa-solid fa-exclamation-triangle text-yellow-600" />
                    <span className="font-medium text-yellow-800">Warnings</span>
                  </div>
                  <ul className="space-y-1 text-sm text-yellow-700">
                    <li>• Staff travel - Missing vendor information</li>
                    <li>• Staff travel - Unit cost is $0</li>
                  </ul>
                </div>

                <Accordion title="Hidden Items (0)">No items are hidden from client view.</Accordion>
                <Accordion title="Unusual Service/Tax Settings">
                  <div className="space-y-2">
                    <div>• AV - Full day package: Service OFF (Production typically has service)</div>
                    <div>• Staff travel: Tax ON (Travel typically tax-exempt)</div>
                  </div>
                </Accordion>
                <Accordion title="Option Differences">
                  Option 2 differs from Option 1 by $2,500 (premium bar package).
                </Accordion>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 rounded-lg bg-gray-50 p-6">
              <div className="mb-6 text-center">
                <h3 className="text-xl font-bold text-gray-900">Executive Dinner Proposal</h3>
                <p className="mt-1 text-gray-600">Supermicro • March 15, 2024 • 100 guests</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <h4 className="mb-3 font-semibold text-gray-900">Venue & Facilities</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Venue rental - Main ballroom</span>
                  <span className="font-medium">$6,696.25</span>
                </div>
              </div>
              <div className="border-b border-gray-200 pb-4">
                <h4 className="mb-3 font-semibold text-gray-900">Food & Beverage</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Dinner - 3 course plated (100 guests)</span>
                  <span className="font-medium">$11,383.63</span>
                </div>
              </div>
              <div className="border-b border-gray-200 pb-4">
                <h4 className="mb-3 font-semibold text-gray-900">Production & Technical</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">AV - Full day package</span>
                  <span className="font-medium">$3,810.63</span>
                </div>
              </div>
              <div className="border-b border-gray-200 pb-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Subtotal</span>
                  <span className="font-medium">$21,890.51</span>
                </div>
              </div>
              <div className="border-b border-gray-200 pb-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Ignite Management Fee (20%)</span>
                  <span className="font-medium">$4,378.10</span>
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-blue-900">Total Investment</span>
                  <span className="text-lg font-bold text-blue-900">$26,172.10</span>
                </div>
              </div>
              <div className="mt-6 text-xs text-gray-500">
                <p>
                  This proposal is valid for 30 days. All prices include applicable taxes and service
                  charges.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 p-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-6 py-2 text-gray-600 hover:bg-gray-50"
        >
          <i className="fa-solid fa-arrow-left mr-2" />
          Back to Build Costs
        </button>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-600">
            <i className="fa-solid fa-check-circle mr-1 text-green-500" />
            Ready to export
          </div>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Continue to Export
            <i className="fa-solid fa-arrow-right ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}

