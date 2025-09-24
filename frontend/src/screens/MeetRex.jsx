import React, { useEffect } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import InteractiveRexPreview from '../components/rex/InteractiveRexPreview';

export default function MeetRex() {
  useEffect(() => {
    // Fade-in observer
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll('.fade-in').forEach((el) => io.observe(el));

    // LeaderLine diagram
    const drawLines = () => {
      const container = document.getElementById('diagram-container');
      if (!container || !window.LeaderLine) return;

      // Clear any existing lines
      document.querySelectorAll('.leader-line').forEach((line) => line.remove());

      const options = {
        color: '#60a5fa',
        size: 2,
        path: 'grid',
        startSocket: 'auto',
        endSocket: 'auto',
        hide: true,
      };

      const connect = (startId, endId, extra = {}) => {
        const startEl = document.getElementById(startId);
        const endEl = document.getElementById(endId);
        if (startEl && endEl) {
          return new window.LeaderLine(startEl, endEl, { ...options, ...extra });
        }
        return null;
      };

      const lines = [
        connect('node-job', 'node-agent'),
        connect('node-agent', 'node-bool'),
        connect('node-agent', 'node-leads'),
        connect('node-agent', 'node-msg'),
        connect('node-agent', 'node-reply', { path: 'arc' }),
        connect('node-reply', 'node-sync'),
        connect('node-agent', 'node-sync'),
        connect('node-agent', 'node-notion', { path: 'arc' }),
        connect('node-agent', 'node-linkink'),
      ].filter(Boolean);

      setTimeout(() => {
        lines.forEach((line) => line && line.show('draw', { duration: 600, timing: 'ease-in-out' }));
      }, 100);
    };

    const ensureLeaderLine = () => {
      if (window.LeaderLine) {
        drawLines();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leader-line-new@1.1.9/leader-line.min.js';
      script.async = true;
      script.onload = drawLines;
      document.body.appendChild(script);
    };

    ensureLeaderLine();

    // Redraw on resize (throttled)
    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(drawLines, 300);
    };
    window.addEventListener('resize', onResize);

    // Cleanup
    return () => {
      io.disconnect();
      window.removeEventListener('resize', onResize);
      document.querySelectorAll('.leader-line').forEach((line) => line.remove());
    };
  }, []);

  return (
    <div className="bg-gray-900 text-white font-sans">
      <style>{`
        .fade-in{opacity:0;transform:translateY(12px);transition:opacity .6s ease,transform .6s ease}
        .fade-in.in-view{opacity:1;transform:none}
        .hover-lift{transition:transform .25s ease, box-shadow .25s ease}
        .hover-lift:hover{transform:translateY(-4px)}
        .gradient-bg{background:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%)}
        .gradient-text{background:linear-gradient(135deg,#60a5fa 0%,#a78bfa 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
        .sunrise{position:relative;overflow:hidden}
        .sunrise img{display:block;width:100%;height:auto;transform:scale(1.02);clip-path:inset(0 0 0 0)}
        .fade-in.in-view .sunrise img{animation:sunriseReveal 1.1s ease-out forwards}
        @keyframes sunriseReveal{from{clip-path:inset(100% 0 0 0)}to{clip-path:inset(0 0 0 0)}}
      `}</style>

      {/* Header */}
      <PublicNavbar />

      {/* Hero */}
      <section
        id="hero"
        className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white min-h-[560px] lg:h:[700px] flex items-start lg:items-center pt-24 pb-10 lg:pt-0 fade-in"
      >
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              Meet REX – Your AI <span className="gradient-text">Recruiting Agent</span>
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-slate-300 mb-6 sm:mb-8 leading-relaxed">
              Source leads. Enrich data. Send outreach. Book interviews.<br />All inside one smart assistant—powered by your workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="/pricing"
                className="gradient-bg px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:shadow-2xl transition-shadow"
              >
                Try REX Free
              </a>
              <a
                href="#chat-preview"
                className="border-2 border-white/30 px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-play" />
                See REX in Action
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="space-y-4">
                <div className="chat-bubble bg-blue-500 text-white p-3 rounded-lg rounded-bl-none max-w-xs">
                  Hi! I found 15 qualified candidates for your React Developer role. Want me to start outreach?
                </div>
                <div className="bg-white/20 p-3 rounded-lg rounded-br-none max-w-xs ml-auto">
                  Yes, use the personalized template
                </div>
                <div className="chat-bubble bg-blue-500 text-white p-3 rounded-lg rounded-bl-none max-w-xs">
                  Perfect! I've sent 15 messages and scheduled 3 interviews for next week. Check your calendar!
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gray-900 fade-in">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">How REX Works</h2>
            <p className="text-xl text-gray-300">Three simple steps to transform your recruiting workflow</p>
          </div>

          {/* Diagram */}
          <div className="w-full mb-16">
            <div
              id="diagram-container"
              className="relative w-full max-w-6xl mx-auto h-[780px] sm:h-[700px] rounded-xl border border-white/10 overflow-hidden"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }}
            >
              {/* Nodes */}
              <div
                id="node-job"
                className="absolute top-[5%] left-[5%] sm:left-[10%] w-40 sm:w-52 h-20 sm:h-24 bg-amber-300/90 text-black rounded-2xl border border-amber-200 flex items-center justify-center text-center p-2 shadow-lg"
              >
                <p className="text-lg sm:text-xl font-bold leading-tight">
                  Job
                  <br />
                  Description
                </p>
              </div>

              <div
                id="node-bool"
                className="absolute top-[30%] left-[3%] sm:left-[6%] w-44 sm:w-56 h-24 sm:h-28 bg-gray-800 rounded-2xl border border-white/10 flex items-center justify-center text-center p-3 shadow-lg"
              >
                <p className="font-semibold text-gray-100 text-sm sm:text-base">Generates Boolean Strings + Title Combos</p>
              </div>

              <div
                id="node-leads"
                className="absolute top-[55%] left-[3%] sm:left-[6%] w-44 sm:w-56 h-24 sm:h-28 bg-gray-800 rounded-2xl border border-white/10 flex items-center justify-center text-center p-3 shadow-lg"
              >
                <p className="font-semibold text-gray-100 text-sm sm:text-base">Finds Leads From Apollo &amp; LinkedIn</p>
              </div>

              <div
                id="node-msg"
                className="absolute top-[80%] left-[3%] sm:left-[6%] w-44 sm:w-56 h-24 sm:h-28 bg-gray-800 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center p-3 shadow-lg"
              >
                <p className="font-semibold text-gray-100 text-sm sm:text-base">Sends Messages</p>
                <p className="text-xs text-gray-400">(Your templates or ones it writes)</p>
              </div>

              <div
                id="node-agent"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 sm:w-56 h-20 sm:h-24 bg-gray-100 text-gray-900 rounded-2xl border border-white/20 flex items-center justify-center text-center p-2 shadow-xl"
              >
                <p className="text-xl sm:text-2xl font-bold">🤖 REX</p>
              </div>

              <div
                id="node-reply"
                className="absolute top-[10%] right-[5%] sm:right-[10%] w-48 sm:w-60 h-28 sm:h-32 bg-gray-800 rounded-2xl border border-white/10 flex items-center justify-center text-center p-3 shadow-lg"
              >
                <p className="font-semibold text-gray-100 text-sm sm:text-base">
                  Categorizes replies — handles them or hands off
                </p>
              </div>

              <div
                id="node-sync"
                className="absolute top-[45%] right-[3%] sm:right-[6%] w-52 sm:w-64 h-32 sm:h-40 bg-gray-800 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center p-4 shadow-lg"
              >
                <p className="font-semibold text-gray-100 mb-3 text-sm sm:text-base">Syncs into your workflow</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 opacity-90 text-xs sm:text-sm">
                  <span className="text-gray-300">Zapier</span>
                  <span className="text-gray-300">Slack</span>
                  <span className="text-gray-300">SendGrid</span>
                  <span className="text-gray-300">Gmail</span>
                </div>
              </div>

              <div
                id="node-notion"
                className="absolute bottom-[5%] right-[15%] sm:right-[20%] w-20 sm:w-24 h-20 sm:h-24 bg-gray-800 rounded-2xl border border-white/10 flex items-center justify-center p-2 shadow-lg"
              >
                <span className="text-xs sm:text-sm font-semibold text-white">Notion</span>
              </div>

              <div
                id="node-linkink"
                className="absolute bottom-[0%] left-1/2 -translate-x-1/2 w-40 sm:w-48 h-16 sm:h-20 flex items-center justify-center"
              >
                <span className="text-xs sm:text-sm text-gray-300">HirePilot / REX</span>
              </div>
            </div>
          </div>

          {/* Cards under diagram */}
          <div className="grid lg:grid-cols-3 gap-8">
            {[
              {
                icon: 'fa-search',
                title: 'Source & Score',
                desc: 'REX scans your campaigns, recommends the best candidates, and enriches them using Apollo and LinkedIn.',
              },
              {
                icon: 'fa-envelope',
                title: 'Automate Outreach',
                desc: 'One-click message generation, follow-ups, and personalized outreach at scale.',
              },
              {
                icon: 'fa-calendar',
                title: 'Book Interviews on Autopilot',
                desc: 'Syncs with your calendar. Candidates get scheduled, Slack keeps you updated.',
              },
            ].map((c) => (
              <div key={c.title} className="text-center hover-lift">
                <div className="w-20 h-20 gradient-bg rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className={`fa-solid ${c.icon} text-white text-2xl`} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">{c.title}</h3>
                <p className="text-gray-300 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REX Interactive Preview Section */}
      <section id="rex-interactive" className="py-0 bg-gray-900 fade-in">
        <InteractiveRexPreview />
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 fade-in">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">What Can REX Do?</h2>
            <p className="text-xl text-gray-300">Everything you need to recruit smarter, not harder</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              ['fa-magnifying-glass', 'Candidate Discovery', 'AI-powered sourcing across multiple platforms'],
              ['fa-robot', 'AI Messaging', 'Personalized outreach at scale'],
              ['fa-slack', 'Slack & Calendar Integration', 'Seamless workflow integration'],
              ['fa-plug', 'Zapier & Make Triggers', 'Connect with 1000+ apps'],
              ['fa-phone', 'Phone & Email Lookup', 'Complete contact enrichment'],
              ['fa-gears', 'Custom Workflows', 'Tailored automation rules'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover-lift">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                  <i className={`${icon === 'fa-slack' ? 'fa-brands' : 'fa-solid'} ${icon} text-white text-3xl`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-gray-300">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 fade-in">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Built for Busy Recruiters</h2>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            {[
              { icon: 'fa-building', title: 'Agency Recruiters', desc: 'Scale outreach without extra headcount' },
              { icon: 'fa-users', title: 'In-House Teams', desc: 'Sync with ATS, Slack, and calendar' },
              { icon: 'fa-user', title: 'Solopreneurs', desc: 'Full automation, no extra tools needed' },
            ].map((c) => (
              <div key={c.title} className="text-center">
                <div className="bg-white/10 backdrop-blur-sm p-8 rounded-xl mb-6 border border-white/10">
                  <i className={`fa-solid ${c.icon} text-4xl text-purple-400 mb-4`} />
                  <h3 className="text-2xl font-bold text-white mb-4">{c.title}</h3>
                  <p className="text-gray-300">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results */}
      <section id="results" className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Proven Results</h2>
            <p className="text-xl text-slate-300">See the impact REX makes on your recruiting metrics</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              ['12x', 'Faster lead-to-interview pipeline'],
              ['80%', 'Reduction in manual outreach'],
              ['10+', 'Hours saved per week, per recruiter'],
            ].map(([stat, text]) => (
              <div key={stat} className="text-center">
                <div className="text-6xl font-bold gradient-text mb-4">{stat}</div>
                <p className="text-xl text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chat Preview */}
      <section id="chat-preview" className="py-20 bg-gray-900 fade-in">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-8">Try Chatting with REX on Slack</h2>
          <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 max-w-2xl mx-auto">
            <div className="mb-6 flex justify-center">
              <img src="/REX-slack.gif" alt="REX Slack Preview" className="rounded-xl max-w-full" />
            </div>
            <a href="/login" className="gradient-bg text-white px-8 py-4 rounded-lg font-semibold">
              Ask REX a Question
            </a>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section id="pricing-cta" className="py-20 bg-gray-900 fade-in">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-2xl p-12 border border-purple-500/30">
            <h2 className="text-4xl font-bold text-white mb-6">Ready to Meet REX?</h2>
            <p className="text-xl text-gray-300 mb-8">REX is included in all plans. Start your 7-day free trial today.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <a
                href="/pricing"
                className="bg-white text-blue-700 border-2 border-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50"
              >
                Start for Free →
              </a>
              <a
                href="/pricing"
                className="border-2 border-purple-400 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-purple-900/30"
              >
                View Pricing
              </a>
            </div>
            <p className="text-sm text-gray-400">Start for free. Credits used for enrichment</p>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section id="trust" className="py-16 bg-gray-900 fade-in">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-gray-300 mb-8">Sync your HirePilot recruiting flows with tools you already have</p>
          <div className="flex justify-center items-center space-x-12 opacity-80">
            <img src="/apollo-logo-v2.png" alt="Apollo" className="h-8 brightness-0 invert" />
            <i className="fa-brands fa-linkedin text-4xl text-white" />
            <i className="fa-brands fa-slack text-4xl text-white" />
            <img src="/zapier-icon.png" alt="Zapier" className="h-8 brightness-0 invert" />
            <img src="/make-logo-v1.png" alt="Make" className="h-8 w-auto brightness-0 invert" />
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
