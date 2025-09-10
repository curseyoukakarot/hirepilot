import React, { useEffect } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function MeetRex() {
  useEffect(() => {
    // fade-in observer
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.fade-in').forEach((el) => io.observe(el));

    // LeaderLine setup (desktop only)
    const drawLines = () => {
      const container = document.getElementById('diagram-container');
      if (!container || !window.LeaderLine) return;

      document.querySelectorAll('.leader-line').forEach(line => line.remove());

      const options = {
        color: '#60a5fa',
        size: 3,
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
        lines.forEach((line) => line && line.show('draw', { duration: 500, timing: 'ease-in-out' }));
      }, 100);
    };

    const ensureLeaderLine = () => {
      if (window.innerWidth < 768) return; // skip on mobile
      if (window.LeaderLine) {
        drawLines();
      } else {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leader-line-new@1.1.9/leader-line.min.js';
        script.async = true;
        script.onload = drawLines;
        document.body.appendChild(script);
      }
    };

    ensureLeaderLine();

    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth >= 768) drawLines();
      }, 250);
    };
    window.addEventListener('resize', onResize);

    return () => {
      io.disconnect();
      window.removeEventListener('resize', onResize);
      document.querySelectorAll('.leader-line').forEach(line => line.remove());
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
      `}</style>

      <PublicNavbar />

      {/* Hero */}
      <section id="hero" className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white min-h-[560px] lg:h-[700px] flex items-start lg:items-center pt-24 pb-10 lg:pt-0 fade-in">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              Meet REX – Your AI <span className="gradient-text">Recruiting Co-Pilot</span>
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-slate-300 mb-6 sm:mb-8 leading-relaxed">
              Source leads. Enrich data. Send outreach. Book interviews.<br />All inside one smart assistant—powered by your workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="/pricing" className="gradient-bg px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:shadow-2xl transition-shadow">Try REX Free</a>
              <a href="#chat-preview" className="border-2 border-white/30 px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:bg-white/10 transition-colors flex items-center gap-2"><i className="fa-solid fa-play" />See REX in Action</a>
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
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-white mb-4">How REX Works</h2>
            <p className="text-xl text-gray-300">Three simple steps to transform your recruiting workflow</p>
          </div>

          {/* Mobile stacked flow */}
          <div className="md:hidden space-y-6 mb-16">
            <div className="bg-amber-300/90 text-black rounded-2xl p-4 text-center font-bold">Job Description</div>
            <div className="bg-gray-800 rounded-2xl p-4 text-center">Generates Boolean Strings + Title Combos</div>
            <div className="bg-gray-800 rounded-2xl p-4 text-center">Finds Leads From Apollo & LinkedIn</div>
            <div className="bg-gray-800 rounded-2xl p-4 text-center">
              Sends Messages <br /><span className="text-xs text-gray-400">(Your templates or ones it writes)</span>
            </div>
            <div className="bg-gray-100 text-gray-900 rounded-2xl p-4 text-center font-bold">🤖 REX</div>
            <div className="bg-gray-800 rounded-2xl p-4 text-center">Categorizes replies — handles them or hands off</div>
            <div className="bg-gray-800 rounded-2xl p-4 text-center">
              Syncs into your workflow <br />
              <span className="text-xs text-gray-300">Zapier, Slack, SendGrid, Gmail</span>
            </div>
            <div className="bg-gray-800 rounded-2xl p-4 text-center">Notion</div>
            <div className="text-sm text-gray-300 text-center">HirePilot / REX</div>
          </div>

          {/* Desktop diagram */}
          <div
            id="diagram-container"
            className="hidden md:block relative w-full max-w-6xl mx-auto h-[700px] md:h-[600px] rounded-xl border border-white/10 overflow-hidden"
            style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '30px 30px' }}
          >
            {/* ... your original absolute-positioned nodes ... */}
          </div>

          {/* 3-card grid */}
          <div className="grid lg:grid-cols-3 gap-8 mt-10">
            {[
              { icon: 'fa-search', title: 'Source & Score', desc: 'REX scans your campaigns, recommends the best candidates, and enriches them using Apollo and LinkedIn.' },
              { icon: 'fa-envelope', title: 'Automate Outreach', desc: 'One-click message generation, follow-ups, and personalized outreach at scale.' },
              { icon: 'fa-calendar', title: 'Book Interviews on Autopilot', desc: 'Syncs with your calendar. Candidates get scheduled, Slack keeps you updated.' },
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

      {/* (rest of your sections unchanged: Features, Use Cases, Results, Chat Preview, Pricing CTA, Trust) */}

      <PublicFooter />
    </div>
  );
}
