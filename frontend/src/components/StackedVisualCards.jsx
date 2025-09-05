import React from 'react';

const StackedVisualCards = () => {
  return (
    <section id="stacked-feature-visuals" className="relative py-32 overflow-hidden bg-black">
      <div className="max-w-5xl mx-auto space-y-[-250px] relative z-10 px-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transform hover:-translate-y-1 transition-all duration-500 scroll-fade-in">
          <img
            src="/lead-drawer2.png"
            alt="REX Enrichment Card"
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transform hover:-translate-y-1 transition-all duration-500 scroll-fade-in">
          <img
            src="/enhanced-company-insights.png"
            alt="Company Insights Card"
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transform hover:-translate-y-1 transition-all duration-500 scroll-fade-in">
          <img
            src="/features-callout.png"
            alt="Feature Highlights Card"
            className="w-full h-auto object-cover"
          />
        </div>
      </div>
    </section>
  );
};

export default StackedVisualCards;


