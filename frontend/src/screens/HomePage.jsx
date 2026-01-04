import React, { useEffect, useState } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import StackedVisualCards from '../components/StackedVisualCards';
import GtmStickyPromoBanner from '../components/GtmStickyPromoBanner';

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
    const elements = document.querySelectorAll('.scroll-fade-in, .pipeline-sunrise');
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Subtle parallax for the sunrise image
  useEffect(() => {
    const img = document.getElementById('sunrise-img');
    if (!img) return;

    let rafId = 0;
    const update = () => {
      const rect = img.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 0;

      // Progress: 0 when below viewport, 1 when fully past top
      const start = viewportHeight; // when bottom hits viewport bottom
      const end = -rect.height;     // when top passes above viewport
      const range = start - end || 1;
      const t = Math.max(0, Math.min(1, (start - rect.top) / range));

      // Parallax offset in px. Slight upward movement as user scrolls.
      const parallaxOffset = (1 - t) * 40 - 20; // from +20px to -20px
      const revealBase = img.classList.contains('in-view') ? 0 : 100; // match CSS reveal

      img.style.transform = `translateX(-50%) translateY(${revealBase + parallaxOffset}px)`;
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(rafId);
    };
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
        .pipeline-sunrise { opacity: 0; transform: translateY(100px); transition: transform 0.9s ease-out, opacity 0.9s ease-out; }
        .pipeline-sunrise.in-view { opacity: 1; transform: translateY(0); }
        .accordion { max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.6s ease, opacity 0.4s ease; }
        .accordion.open { max-height: 900px; opacity: 1; }
      `}</style>

      {/* Header */}
      <PublicNavbar />
      <GtmStickyPromoBanner />

      {/* Animated Prompt Hero */}
      <section id="animated-hero" className="pt-24 h-[700px] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-8 leading-tight">
              The All-in-One Recruiting <span className="gradient-text">CRM + ATS</span>
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
            <p className="text-xl text-gray-300 mb-8">An all in one collaborative hiring platform. Powered by AI, driven by data, designed for scale.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/pricing" className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-indigo-700 transition shadow-lg">
                Use Free Forever
              </a>
              <button onClick={() => setIsDemoOpen((v) => !v)} aria-expanded={isDemoOpen} className="border border-gray-700 px-8 py-4 rounded-xl text-lg font-semibold text-gray-300 hover:bg-gray-800 transition-colors">
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
            <div className="mt-6 flex justify-center">
              <a href="/workflows" className="bg-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                Explore Workflows
              </a>
            </div>
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
                <div className="text-3xl font-bold text-blue-500 mb-2">12x</div>
                <div className="text-gray-300">Faster lead-to-interview pipeline</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-500 mb-2">80%</div>
                <div className="text-gray-300">Reduction in manual outreach</div>
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

      {/* Features Overview */}
      <section id="features-overview" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Sourcing, ATS, CRM, and Collaboration — Unified</h2>
            <p className="text-xl text-gray-600">Everything you need in one powerful platform</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <i className="fa-solid fa-briefcase text-blue-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Job REQs & Pipelines</h3>
              <p className="text-gray-600">Custom stages, notes, candidate tracking</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <i className="fa-brands fa-chrome text-green-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Chrome Extension</h3>
              <p className="text-gray-600">Source from LinkedIn, Apollo, SalesNav</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <i className="fa-solid fa-robot text-purple-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Messaging</h3>
              <p className="text-gray-600">REX drafts, sequences, replies</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <i className="fa-solid fa-users text-orange-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Client CRM</h3>
              <p className="text-gray-600">Convert leads to clients & deals</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <i className="fa-solid fa-credit-card text-yellow-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Stripe Invoicing</h3>
              <p className="text-gray-600">Create/send invoices inside HirePilot</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <i className="fa-solid fa-user-plus text-indigo-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Guest Collaboration</h3>
              <p className="text-gray-600">Invite hiring managers or clients</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <i className="fa-solid fa-link text-red-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Zapier & API</h3>
              <p className="text-gray-600">Automate anything</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                <i className="fa-solid fa-id-card text-teal-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Recruiting AI Agent</h3>
              <p className="text-gray-600">REX automates every part of your workflow</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sunrise Image Reveal */}
      <section id="pipeline-sunrise" className="relative py-8 sm:py-12 bg-black overflow-hidden">
        <div className="w-screen px-6">
          <img
            id="sunrise-img"
            src="/homepage-sunrise.png"
            alt="HirePilot pipeline overview"
            className="pipeline-sunrise w-[120vw] md:w-[110vw] max-w-none relative left-1/2 -translate-x-1/2 rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] object-cover"
          />
        </div>
      </section>

      {/* Deeper Value Section */}
      <section id="deeper-value" className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">Everything You Need to Run a Modern Recruiting Operation</h2>
            <div className="flex items-center justify-center space-x-4 text-white text-lg">
              <span className="bg-white/20 px-4 py-2 rounded-lg">Source</span>
              <i className="fa-solid fa-arrow-right"></i>
              <span className="bg-white/20 px-4 py-2 rounded-lg">Enrich</span>
              <i className="fa-solid fa-arrow-right"></i>
              <span className="bg-white/20 px-4 py-2 rounded-lg">Engage</span>
              <i className="fa-solid fa-arrow-right"></i>
              <span className="bg-white/20 px-4 py-2 rounded-lg">Track</span>
              <i className="fa-solid fa-arrow-right"></i>
              <span className="bg-white/20 px-4 py-2 rounded-lg">Close</span>
            </div>
          </div>
          <div className="max-w-5xl mx-auto">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center mt-1">
                  <i className="fa-solid fa-check text-green-800 text-sm"></i>
                </div>
                <p className="text-white text-lg">Job REQs and candidate pipelines with notes and custom stages</p>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center mt-1">
                  <i className="fa-solid fa-check text-green-800 text-sm"></i>
                </div>
                <p className="text-white text-lg">AI-drafted outreach on email + LinkedIn</p>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center mt-1">
                  <i className="fa-solid fa-check text-green-800 text-sm"></i>
                </div>
                <p className="text-white text-lg">Stripe-powered billing and invoicing</p>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center mt-1">
                  <i className="fa-solid fa-check text-green-800 text-sm"></i>
                </div>
                <p className="text-white text-lg">Collaborate with hiring managers and clients</p>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center mt-1">
                  <i className="fa-solid fa-check text-green-800 text-sm"></i>
                </div>
                <p className="text-white text-lg">Chrome extension for seamless sourcing</p>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center mt-1">
                  <i className="fa-solid fa-check text-green-800 text-sm"></i>
                </div>
                <p className="text-white text-lg">Slack alerts + workflow automation with Zapier and Make</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="comparison" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">HirePilot vs. Legacy ATS Tools</h2>
            <p className="text-xl text-gray-600">Built for speed. Designed for flexibility. Priced for growth.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl shadow-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-gray-900">Feature</th>
                  <th className="px-6 py-4 text-center font-semibold text-blue-600">HirePilot</th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-900">Lever</th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-900">Ashby</th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-900">Greenhouse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 font-medium text-gray-900">Chrome Extension</td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-check text-green-600"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-times text-red-500"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-times text-red-500"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-times text-red-500"></i></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">AI Outreach</td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-check text-green-600"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-times text-red-500"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-check text-green-600"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-times text-red-500"></i></td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium text-gray-900">In-App Invoicing</td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-check text-green-600"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-times text-red-500"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-times text-red-500"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-times text-red-500"></i></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">Guest Collaboration</td>
                  <td className="px-6 py-4 text-center text-green-600 font-medium">Unlimited</td>
                  <td className="px-6 py-4 text-center text-orange-500 font-medium">Limited</td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-times text-red-500"></i></td>
                  <td className="px-6 py-4 text-center text-orange-500 font-medium">Limited</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium text-gray-900">Zapier + API</td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-check text-green-600"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-check text-green-600"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-check text-green-600"></i></td>
                  <td className="px-6 py-4 text-center"><i className="fa-solid fa-check text-green-600"></i></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">Price</td>
                  <td className="px-6 py-4 text-center text-green-600 font-bold">Free Forever</td>
                  <td className="px-6 py-4 text-center text-red-500 font-bold">$$$</td>
                  <td className="px-6 py-4 text-center text-red-500 font-bold">$$$</td>
                  <td className="px-6 py-4 text-center text-red-500 font-bold">$$$</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Integrations (Dark Mode) */}
      <section id="integrations-dark" className="relative py-20 md:py-24 bg-gray-950 text-white overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[36rem] rounded-full bg-gradient-to-b from-blue-500/10 to-purple-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-[28rem] rounded-full bg-gradient-to-t from-purple-500/10 to-blue-500/10 blur-3xl" />
        <div className="container mx-auto px-6 text-center relative">
          <h3 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-10 md:mb-12">
            Sync your HirePilot recruiting flows with tools you already have
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-8 md:gap-12 justify-items-center max-w-5xl mx-auto">
            {[
              ['/apollo-logo-v2.png','Apollo'],
              ['fa-brands fa-linkedin','LinkedIn'],
              ['fa-brands fa-slack','Slack'],
              ['/zapier-icon.png','Zapier'],
              ['/make-logo-v1.png','Make'],
            ].map(([item, alt]) => (
              <div key={alt} className="group rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-3 md:p-4 hover:bg-white/10 transition-colors duration-300 w-[88px] h-[72px] md:w-[104px] md:h-[88px] flex items-center justify-center">
                {String(item).startsWith('fa-') ? (
                  <i className={`${item} text-white text-3xl md:text-4xl opacity-95`} aria-label={alt} title={alt} />
                ) : (
                  <img src={item} alt={alt} className="h-8 md:h-10 w-auto brightness-0 invert opacity-95 drop-shadow transition duration-300" />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* Pricing CTA */}
      <section id="pricing-cta" className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl font-bold">Start hiring smarter with AI</h2>
            <p className="text-xl text-blue-100">Recruiting shouldn't be slow. Let HirePilot automate it for you.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/pricing" className="bg-white text-indigo-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-shadow shadow-lg">Use Free Forever</a>
              <a href="https://youtu.be/zhwZg_8ruyU" target="_blank" rel="noopener" className="border-2 border-white text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-white/10 transition-colors">Watch Demo</a>
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


