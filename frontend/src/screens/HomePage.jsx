import React, { useEffect, useState } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import StackedVisualCards from '../components/StackedVisualCards';

const HomePage = () => {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  useEffect(() => {
    const texts = [
      'Find senior React developers in San Francisco',
      'Source Python engineers with ML experience',
      'Recruit DevOps specialists for startup',
      'Hire full-stack developers remotely',
    ];
    let currentTextIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;
    let isCancelled = false;

    const typingElement = document.getElementById('typing-text');

    function typeWriter() {
      if (!typingElement || isCancelled) return;
      const currentText = texts[currentTextIndex];

      if (!isDeleting) {
        typingElement.textContent = currentText.substring(0, currentCharIndex + 1);
        currentCharIndex += 1;
        if (currentCharIndex === currentText.length) {
          setTimeout(() => {
            isDeleting = true;
            if (!isCancelled) typeWriter();
          }, 2000);
          return;
        }
      } else {
        typingElement.textContent = currentText.substring(0, currentCharIndex - 1);
        currentCharIndex -= 1;
        if (currentCharIndex === 0) {
          isDeleting = false;
          currentTextIndex = (currentTextIndex + 1) % texts.length;
        }
      }

      const speed = isDeleting ? 50 : 100;
      setTimeout(typeWriter, speed);
    }

    typeWriter();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    const elements = document.querySelectorAll('.scroll-fade-in');
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-black text-white">
      <style>{`
        ::-webkit-scrollbar { display: none; }
        html, body { -ms-overflow-style: none; scrollbar-width: none; }
        body { font-family: 'Inter', sans-serif; }
        .typing-animation::after { content: '|'; animation: blink 1s infinite; }
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        .gradient-text { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .feature-card { transform: translateY(0); transition: transform 0.3s ease; }
        .feature-card:hover { transform: translateY(-10px); }
        .scroll-fade-in { opacity: 0; transform: translateY(40px); transition: all 0.6s ease-out; }
        .scroll-fade-in.in-view { opacity: 1; transform: translateY(0); }
        .accordion { max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.6s ease, opacity 0.4s ease; }
        .accordion.open { max-height: 900px; opacity: 1; }
      `}</style>

      {/* Header */}
      <PublicNavbar />

      {/* Animated Prompt Hero */}
      <section id="animated-hero" className="pt-24 h-[700px] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-8">
              AI-Powered <span className="gradient-text">Recruiting</span>
                </h1>
            <div className="bg-gray-900 rounded-xl p-8 mb-8 text-left max-w-2xl mx-auto">
              <div className="flex items-center mb-4">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-gray-400 text-sm ml-4">HirePilot AI Assistant</span>
              </div>
              <div className="text-green-400 mb-2">$ REX</div>
              <div id="typing-text" className="text-white text-lg typing-animation">Find senior React developers in San Francisco</div>
            </div>
            <p className="text-xl text-gray-300 mb-8">Automate candidate sourcing, screening, and outreach with AI</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/pricing" className="bg-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors">
                Start Free Trial
              </a>
              <button onClick={() => setIsDemoOpen((v) => !v)} aria-expanded={isDemoOpen} className="border border-gray-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors">
                <i className="fa-solid fa-play mr-2"></i>Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Accordion */}
      <section id="demo-accordion" className="container mx-auto px-6">
        <div className={`accordion ${isDemoOpen ? 'open' : ''} bg-gray-900/70 border border-white/10 rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-sm max-w-4xl mx-auto`}> 
          <div className="p-4 sm:p-6">
            <div className="aspect-video w-full rounded-xl overflow-hidden">
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/zhwZg_8ruyU?rel=0&modestbranding=1"
                title="HirePilot Demo"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stacked Visual Cards */}
      <StackedVisualCards />

      {/* Feature Card Stack */}
      <section id="feature-stack" className="py-24 bg-gray-950">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything you need to hire faster</h2>
            <p className="text-xl text-gray-400">From sourcing to closing, HirePilot handles it all</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="feature-card bg-gradient-to-br from-blue-900/50 to-blue-800/30 p-8 rounded-2xl border border-blue-700/30 scroll-fade-in">
              <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mb-6">
                <i className="fa-solid fa-search text-2xl text-white"></i>
              </div>
              <h3 className="text-2xl font-bold mb-4">AI Candidate Sourcing</h3>
              <p className="text-gray-300 mb-6">Find qualified candidates across multiple platforms using natural language search</p>
              <ul className="space-y-2 text-gray-400">
                <li><i className="fa-solid fa-check text-green-500 mr-2"></i>LinkedIn, Apollo, and more</li>
                <li><i className="fa-solid fa-check text-green-500 mr-2"></i>Real-time profile analysis</li>
                <li><i className="fa-solid fa-check text-green-500 mr-2"></i>Skill matching algorithms</li>
              </ul>
            </div>
            <div className="feature-card bg-gradient-to-br from-purple-900/50 to-purple-800/30 p-8 rounded-2xl border border-purple-700/30 scroll-fade-in">
              <div className="w-16 h-16 bg-purple-600 rounded-xl flex items-center justify-center mb-6">
                <i className="fa-solid fa-robot text-2xl text-white"></i>
              </div>
              <h3 className="text-2xl font-bold mb-4">Automated Outreach</h3>
              <p className="text-gray-300 mb-6">Personalized messages that actually get responses</p>
              <ul className="space-y-2 text-gray-400">
                <li><i className="fa-solid fa-check text-green-500 mr-2"></i>AI-generated personalization</li>
                <li><i className="fa-solid fa-check text-green-500 mr-2"></i>Multi-channel campaigns</li>
                <li><i className="fa-solid fa-check text-green-500 mr-2"></i>Response tracking</li>
              </ul>
            </div>
            <div className="feature-card bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 p-8 rounded-2xl border border-cyan-700/30 scroll-fade-in">
              <div className="w-16 h-16 bg-cyan-600 rounded-xl flex items-center justify-center mb-6">
                <i className="fa-solid fa-chart-line text-2xl text-white"></i>
              </div>
              <h3 className="text-2xl font-bold mb-4">Smart Analytics</h3>
              <p className="text-gray-300 mb-6">Track performance and optimize your hiring funnel</p>
              <ul className="space-y-2 text-gray-400">
                <li><i className="fa-solid fa-check text-green-500 mr-2"></i>Response rate tracking</li>
                <li><i className="fa-solid fa-check text-green-500 mr-2"></i>Pipeline analytics</li>
                <li><i className="fa-solid fa-check text-green-500 mr-2"></i>ROI calculations</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section id="social-proof" className="relative py-24 bg-gray-900">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-8">Built for teams that want more hires in less time</h2>
            <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500 mb-2">5,200+</div>
                <div className="text-gray-300">Candidates Sourced</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-500 mb-2">300+</div>
                <div className="text-gray-300">Interviews Booked</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-cyan-500 mb-2">1,000s</div>
                <div className="text-gray-300">Hours Saved</div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-gray-800 p-8 rounded-xl">
              <p className="text-lg mb-6">"I landed my first client in 3 weeks with HirePilot!"</p>
              <div className="text-center">
                <div className="font-semibold">Sarah J.</div>
                <div className="text-gray-400">Freelance Tech Recruiter</div>
              </div>
            </div>
            <div className="bg-gray-800 p-8 rounded-xl">
              <p className="text-lg mb-6">"I made 8k in my first 6 weeks"</p>
              <div className="text-center">
                <div className="font-semibold">Dejanira (Dej) L.</div>
                <div className="text-gray-400">Freelance Tech Recruiter</div>
              </div>
            </div>
            <div className="bg-gray-800 p-8 rounded-xl">
              <p className="text-lg mb-6">"The engagement features have saved countless hours."</p>
              <div className="text-center">
                <div className="font-semibold">Emily R.</div>
                <div className="text-gray-400">Talent Lead</div>
              </div>
            </div>
          </div>
          <div className="mt-16 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </section>

      {/* Pricing CTA */}
      <section id="pricing-cta" className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl font-bold">Start hiring smarter with AI</h2>
            <p className="text-xl text-blue-100">Recruiting shouldn't be slow. Let HirePilot automate it for you.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/pricing" className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors">Get Started Free</a>
              <a href="https://youtu.be/zhwZg_8ruyU" target="_blank" rel="noopener" className="border border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white/10 transition-colors">Watch Demo</a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
};

export default HomePage;


