import React, { useEffect } from 'react';

const StackedVisualCards = () => {
  useEffect(() => {
    const section = document.getElementById('stacked-feature-visuals');
    if (!section) return;
    const cards = Array.from(section.querySelectorAll('.stack-card'));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = cards.indexOf(entry.target);
          cards.forEach((card, i) => {
            if (i < index) {
              card.classList.add('stack-faded');
            } else {
              card.classList.remove('stack-faded');
            }
          });

          // Reveal thresholds per card (hide 2nd a bit longer)
          const ratio = entry.intersectionRatio;
          const threshold = index === 1 ? 0.6 : index === 2 ? 0.45 : 0.25;
          if (ratio >= threshold) entry.target.classList.add('visible');
          else entry.target.classList.remove('visible');
        });
      },
      { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }
    );

    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="stacked-feature-visuals" className="relative py-32 overflow-hidden bg-black">
      <div className="container mx-auto px-6">
        <div className="sticky top-20 z-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 inline-block mx-auto px-4 py-2 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10">
            Search any Candidate with <span className="gradient-text">Enhanced Enrichment</span>
          </h2>
        </div>
      </div>
      <style>{`
        .stack-card { transition: opacity 0.6s ease, transform 0.6s ease, filter 0.6s ease, box-shadow 0.6s ease; }
        .stack-card.stack-faded { opacity: 0; transform: translateY(-28px) scale(0.985); filter: blur(1px); }
        .reveal-card { opacity: 0; transform: translateY(48px); }
        .reveal-card.visible { opacity: 1; transform: translateY(0); }
      `}</style>
      {/* First Card (no overlap wrapper) */}
      <div className="max-w-5xl mx-auto px-4 pb-6">
        {/* Card 1 */}
        <div className="stack-card reveal-card bg-white rounded-2xl shadow-[0_50px_120px_-35px_rgba(0,0,0,0.9)] ring-1 ring-black/20 border border-gray-200 overflow-hidden transform hover:-translate-y-1 transition-all duration-500 relative">
          <img
            src="/lead-drawer2.png"
            alt="REX Enrichment Card"
            className="w-full h-auto object-cover"
          />
        </div>
      </div>

      {/* Secondary Title in flow (right-aligned) */}
      <div className="max-w-5xl mx-auto px-4 mb-8 md:mb-10 flex justify-end">
        <h3 className="text-xl md:text-3xl font-semibold text-right inline-block px-3 py-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10">
          Enhance your search with <span className="gradient-text">Detailed Company Insights</span>
        </h3>
      </div>

      {/* Remaining stack with light overlap */}
      <div className="max-w-5xl mx-auto space-y-[-70px] md:space-y-[-90px] lg:space-y-[-100px] relative z-10 px-4 pb-32">
        {/* Card 2 */}
        <div className="stack-card reveal-card bg-white rounded-2xl shadow-[0_50px_120px_-35px_rgba(0,0,0,0.9)] ring-1 ring-black/20 border border-gray-200 overflow-hidden transform hover:-translate-y-1 transition-all duration-500 relative">
          <img
            src="/enhanced-2.png"
            alt="Company Insights Card"
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Card 3 */}
        <div className="pt-24 md:pt-28 lg:pt-36 flex justify-center overflow-visible">
          <div className="stack-card reveal-card bg-white rounded-2xl shadow-[0_50px_120px_-35px_rgba(0,0,0,0.9)] ring-1 ring-black/20 border border-gray-200 overflow-hidden transform hover:-translate-y-1 transition-all duration-500 relative origin-center" style={{ transform: 'scale(1.33)' }}>
            <img
              src="/features-callout.png"
              alt="Feature Highlights Card"
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default StackedVisualCards;


