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
        });
      },
      { threshold: 0.45 }
    );

    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="stacked-feature-visuals" className="relative py-32 overflow-hidden bg-black">
      <style>{`
        .stack-card { transition: opacity 0.5s ease, transform 0.5s ease, filter 0.5s ease, box-shadow 0.5s ease; }
        .stack-card.stack-faded { opacity: 0; transform: translateY(-24px) scale(0.985); filter: blur(1px); }
      `}</style>
      <div className="max-w-5xl mx-auto space-y-[-180px] md:space-y-[-200px] lg:space-y-[-220px] relative z-10 px-4 pb-24">
        {/* Card 1 */}
        <div className="stack-card bg-white rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-black/10 border border-gray-200 overflow-hidden transform hover:-translate-y-1 transition-all duration-500 scroll-fade-in relative">
          <img
            src="/lead-drawer2.png"
            alt="REX Enrichment Card"
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Card 2 */}
        <div className="stack-card bg-white rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-black/10 border border-gray-200 overflow-hidden transform hover:-translate-y-1 transition-all duration-500 scroll-fade-in relative">
          <img
            src="/enhanced-company-insights.png"
            alt="Company Insights Card"
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Card 3 */}
        <div className="stack-card bg-white rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-black/10 border border-gray-200 overflow-hidden transform hover:-translate-y-1 transition-all duration-500 scroll-fade-in relative">
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


