import React, { useEffect } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function Copilot() {
  useEffect(()=>{
    const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target);}})},{threshold:.15});
    document.querySelectorAll('.fade-in').forEach(el=>io.observe(el));
    return ()=>io.disconnect();
  },[]);

  // Parallax for cascading images (invoice + stripe) – move inward toward center
  useEffect(()=>{
    const section=document.getElementById('billing-parallax');
    const left=document.getElementById('parallax-left');
    const right=document.getElementById('parallax-right');
    if(!section||!left||!right) return;
    let raf=0;
    const update=()=>{
      const rect=section.getBoundingClientRect();
      const vh=window.innerHeight||0;
      const start=vh; // when section enters viewport
      const end=-rect.height; // when section leaves top
      const range=start-end||1;
      const t=Math.max(0,Math.min(1,(start-rect.top)/range));
      const base=144; // 1.5in in CSS pixels
      const inward=t*80+base; // move inward plus fixed offset
      const vertical=(1-t)*10-5; // slight vertical drift
      left.style.transform=`translateX(${inward}px) translateY(${vertical}px) rotate(0deg)`;
      right.style.transform=`translateX(${-inward}px) translateY(${-vertical}px) rotate(0deg)`;
    };
    const onScroll=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(update)};
    update();
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',onScroll);
    return ()=>{window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll);cancelAnimationFrame(raf)};
  },[]);
  return (
    <div className="h-full text-base-content">
      <div className="min-h-screen bg-gray-900 text-white">
        <style>{`.fade-in{opacity:0;transform:translateY(12px);transition:opacity .6s ease,transform .6s ease}.fade-in.in-view{opacity:1;transform:none}.gradient-text{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}`}</style>
        {/* Header */}
        <PublicNavbar />

        {/* Hero */}
        <section id="hero" className="bg-gradient-to-b from-blue-900 via-blue-800 to-gray-900 h-[800px] pt-32 fade-in">
          <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col-reverse md:flex-row items-center justify-between gap-12">
            <div className="w-full md:w-1/2 text-center md:text-left">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight text-white">
                Sourcing Made Simple.
              </h1>
              <p className="mt-6 text-xl text-gray-200">
                Save BIG on hiring costs - cut down on sourcing time. Create your own pipeline in minutes, not months. Build a team.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:justify-start justify-center">
                <a href="#" className="group bg-white text-blue-700 font-semibold py-3 px-10 whitespace-nowrap rounded-lg shadow-lg hover:shadow-xl transition-all duration-200">
                  Start for Free <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                </a>
                <a href="https://form.typeform.com/to/cnUZ9PgW" target="_blank" rel="noopener" className="bg-blue-700 text-white font-semibold py-3 px-10 whitespace-nowrap rounded-lg shadow-lg hover:bg-blue-600 transition-all duration-200">
                  <i className="fa-regular fa-calendar mr-2"></i> Book Demo
                </a>
              </div>
            </div>
            {/* Demo GIF for hero */}
            <div className="w-full mt-12">
              <img src="/copilot-hero.gif" alt="HirePilot Copilot demo" className="w-full rounded-xl shadow-2xl" />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 bg-gray-900 fade-in">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-semibold mb-4 text-white">See HirePilot in action</h2>
            <p className="text-gray-300 mb-12 max-w-2xl mx-auto">Experience how HirePilot transforms your hiring workflow—from the first search to the final interview. Watch our platform in real-time as it automatically sources top talent, sends high-converting outreach, and books interviews without the back-and-forth—so you can spend more time hiring and less time managing.</p>
            {/* Demo GIF */}
            <div className="mb-12">
              <img src="/hp-pipeline.gif" alt="HirePilot pipeline demo" className="w-full rounded-xl shadow-2xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div id="feature-1" className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-magnifying-glass text-blue-600 text-xl"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">Smart Sourcing</h3>
                <p className="text-gray-300">Unlock a pipeline of qualified candidates in minutes—not days. Launch automated sourcing campaigns that run while you sleep, and watch your top-of-funnel fill itself.</p>
              </div>
              <div id="feature-2" className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-comments text-blue-600 text-xl"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">Intelligent Messaging</h3>
                <p className="text-gray-300">Say goodbye to generic templates. Say hello to real conversations. HirePilot crafts personalized messages at scale that actually get responses. Whether you're reaching out to one candidate or one thousand, every message is tailored to the individual—powered by AI that understands role context, tone, and timing.</p>
              </div>
              <div id="feature-3" className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-calendar-check text-blue-600 text-xl"></i>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">Real-Time Pipeline Insights</h3>
                <p className="text-gray-300">No more guessing where candidates stand. HirePilot gives you a clear, visual pipeline of every role in progress—who's been sourced, messaged, replied, interviewed, or dropped off. Get actionable insights on outreach performance, reply rates, and time-to-hire so you can optimize what works and fix what doesn't—all from one unified dashboard.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Included */}
        <section id="features-section" className="py-20 px-6 fade-in">
          <div className="max-w-5xl mx-auto">
            <div className="fade-in">
              <h2 className="text-4xl md:text-5xl font-bold mb-8">
                <span className="gradient-text">Collaboration</span> Built into every job req.
              </h2>

              <div className="space-y-6">
                <div className="flex items-start gap-4 fade-in" style={{ animationDelay: '0.1s' }}>
                  <i className="fa-solid fa-check text-green-400 text-xl mt-1"></i>
                  <p className="text-lg">Invite collaborators by email (even if they're not in HirePilot)</p>
                </div>
                <div className="flex items-start gap-4 fade-in" style={{ animationDelay: '0.2s' }}>
                  <i className="fa-solid fa-check text-green-400 text-xl mt-1"></i>
                  <p className="text-lg">Assign team roles and permission levels</p>
                </div>
                <div className="flex items-start gap-4 fade-in" style={{ animationDelay: '0.3s' }}>
                  <i className="fa-solid fa-check text-green-400 text-xl mt-1"></i>
                  <p className="text-lg">Track every edit, comment, and status update</p>
                </div>
                <div className="flex items-start gap-4 fade-in" style={{ animationDelay: '0.4s' }}>
                  <i className="fa-solid fa-check text-green-400 text-xl mt-1"></i>
                  <p className="text-lg">Leave notes and tag your teammates</p>
                </div>
                <div className="flex items-start gap-4 fade-in" style={{ animationDelay: '0.5s' }}>
                  <i className="fa-solid fa-check text-green-400 text-xl mt-1"></i>
                  <p className="text-lg">See the full candidate pipeline — in motion</p>
                </div>
                <div className="flex items-start gap-4 fade-in" style={{ animationDelay: '0.6s' }}>
                  <i className="fa-solid fa-check text-green-400 text-xl mt-1"></i>
                  <p className="text-lg">Collaborate with REX for summaries, suggestions, and candidate scoring</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Collaboration Sunrise Image */}
        <section id="collaboration-sunrise" className="relative py-8 sm:py-12 bg-gray-900 overflow-hidden fade-in">
          <div className="w-screen px-6">
            <img
              src="/collaborate.png"
              alt="collaboration workflow overview"
              className="w-[60vw] md:w-[55vw] max-w-none relative left-1/2 -translate-x-1/2 rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] object-cover"
            />
          </div>
        </section>

        {/* Cascading Billing Images (Parallax) */}
        <section id="billing-parallax" className="relative py-16 bg-gray-900 overflow-hidden fade-in">
          <div className="w-screen px-6">
            <h3 className="text-center text-2xl md:text-3xl font-bold mb-6">
              <span className="gradient-text">Request Payments directly from your portal</span>
            </h3>
            <div className="relative h-[420px] md:h-[520px]">
              <img
                id="parallax-left"
                src="/invoice.png"
                alt="in-app invoice preview"
                className="absolute top-6 md:top-10 -left-[4vw] w-[54vw] md:w-[38vw] max-w-none rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] will-change-transform transition-transform duration-300"
              />
              <img
                id="parallax-right"
                src="/stripe.png"
                alt="stripe integration preview"
                className="absolute bottom-6 md:bottom-10 -right-[4vw] w-[54vw] md:w-[38vw] max-w-none rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] will-change-transform transition-transform duration-300"
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="py-20 bg-gradient-to-r from-blue-900 to-blue-700 text-white fade-in">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold mb-6">Start your hiring process with HirePilot. Save 100+ hours per role.</h2>
            <p className="text-xl mb-10 opacity-90">Join thousands of companies hiring better with AI.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/pricing" className="bg-white text-blue-600 font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200">
                Get Started Free <i className="fa-solid fa-arrow-right ml-2"></i>
              </a>
              <a href="https://form.typeform.com/to/cnUZ9PgW" target="_blank" rel="noopener" className="border-2 border-white text-white font-semibold py-4 px-8 rounded-lg hover:bg-white/10 transition-colors duration-200">
                <i className="fa-regular fa-calendar mr-2"></i> Schedule Demo
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <PublicFooter />
      </div>
    </div>
  );
} 