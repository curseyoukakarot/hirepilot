import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaInbox,
  FaGhost,
  FaUsers,
  FaUpload,
  FaBullseye,
  FaLightbulb,
  FaGlobe,
  FaRobot,
  FaRegFileAlt,
  FaLinkedin,
  FaEnvelope,
  FaCrosshairs,
  FaComments,
  FaHandshake,
  FaUserTie,
  FaRocket,
  FaStar,
} from 'react-icons/fa';

const primary = '#3b82f6';

function Pill({ num, color, label, description }: { num: number; color: string; label: string; description: string }) {
  return (
    <div className="bg-gray-800 p-8 rounded-2xl text-center border border-gray-700">
      <div
        className="text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold"
        style={{ background: color }}
      >
        {num}
      </div>
      <h3 className="text-xl font-bold text-white mb-4">{label}</h3>
      <p className="text-gray-300">{description}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-700">
      <div className="text-2xl mb-4 text-[#3b82f6]">{icon}</div>
      <h4 className="font-semibold text-white mb-2">{title}</h4>
      <p className="text-gray-300">{description}</p>
    </div>
  );
}

export default function JobSeekerLandingPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');

  const rexPrompts = useMemo(
    () => [
      'Help me rewrite my resume for a software engineer role',
      'Write an outreach message to a hiring manager at Google',
      'Help me prepare for a product manager interview',
    ],
    []
  );

  const handleStart = useCallback(() => {
    navigate('/signup');
  }, [navigate]);

  const goToRex = useCallback(
    (text?: string) => {
      const prefill = text || prompt;
      const search = prefill ? `?prefill=${encodeURIComponent(prefill)}` : '';
      navigate(`/prep/rex-chat${search}`);
    },
    [navigate, prompt]
  );

  const handleSend = useCallback(() => {
    if (!prompt.trim()) return;
    goToRex(prompt.trim());
  }, [goToRex, prompt]);

  return (
    <div className="bg-gray-900 font-sans text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="text-xl font-bold text-white">HirePilot Jobs</div>
            </div>
            <nav className="hidden md:flex items-center space-x-8 text-sm">
              <a href="#method" className="text-gray-400 hover:text-white">
                How it works
              </a>
              <a href="#rex-preview" className="text-gray-400 hover:text-white">
                Try REX
              </a>
              <a href="#pricing" className="text-gray-400 hover:text-white">
                Pricing
              </a>
              <button
                className="bg-[#3b82f6] text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                onClick={handleStart}
              >
                Start Free
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="hero" className="bg-gradient-to-b from-gray-800 to-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
              Stop applying. Start conversations with hiring managers.
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              HirePilot Jobs helps you generate a pro resume, build a personal landing page, and use REX to craft direct
              outreach that gets replies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <button
                className="bg-[#3b82f6] text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-600"
                onClick={handleStart}
              >
                Start Free
              </button>
              <button
                className="border border-[#3b82f6] text-[#3b82f6] px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800"
                onClick={() => goToRex()}
              >
                Try REX Chat
              </button>
            </div>
            <p className="text-sm text-gray-400">Built by recruiters. Designed for job seekers.</p>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="py-16 bg-gray-800">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-8">The job board game is broken</h2>
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-700">
              <FaInbox className="text-red-400 text-2xl mb-4" />
              <p className="text-gray-300">Applications disappear into ATS black holes</p>
            </div>
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-700">
              <FaGhost className="text-red-400 text-2xl mb-4" />
              <p className="text-gray-300">Endless ghosting and automated rejections</p>
            </div>
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-700">
              <FaUsers className="text-red-400 text-2xl mb-4" />
              <p className="text-gray-300">Competing with 1000+ other applicants</p>
            </div>
          </div>
          <p className="text-lg font-semibold text-white">The fastest path is direct outreach.</p>
        </div>
      </section>

      {/* Method */}
      <section id="method" className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">The HirePilot Jobs method</h2>
            <p className="text-xl text-gray-300">This is the playbook recruiters use — now you have it.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Pill num={1} color="#3b82f6" label="Position" description="Resume + LinkedIn rewrite that positions you as the perfect candidate" />
            <Pill num={2} color="#22c55e" label="Package" description="Personal landing page that showcases your value proposition" />
            <Pill num={3} color="#a855f7" label="Prospect" description="Direct outreach scripts that get hiring managers to respond" />
          </div>
        </div>
      </section>

      {/* Walkthrough */}
      <section id="walkthrough" className="py-20 bg-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Your 5-step journey to job success</h2>
            <p className="text-xl text-gray-300">Simple, guided, and effective</p>
          </div>
          <div className="grid md:grid-cols-5 gap-6">
            <FeatureCard icon={<FaUpload />} title="Upload resume" description="Get instant rewrite" />
            <FeatureCard icon={<FaBullseye />} title="Set target role" description="Define your goals" />
            <FeatureCard icon={<FaLightbulb />} title="Generate angles" description="Outreach strategies" />
            <FeatureCard icon={<FaGlobe />} title="Build landing page" description="Professional showcase" />
            <FeatureCard icon={<FaRobot />} title="Chat with REX" description="Refine everything" />
          </div>
          <div className="text-center mt-8">
            <p className="text-lg font-semibold text-green-400">🎁 Bonus credits for completing setup</p>
          </div>
        </div>
      </section>

      {/* REX preview */}
      <section id="rex-preview" className="py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Meet REX, your AI job coach</h2>
            <p className="text-xl text-gray-300">Try a quick conversation to see how REX can help</p>
          </div>

          <div className="bg-gray-800 rounded-2xl p-8 max-w-2xl mx-auto border border-gray-700">
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 mb-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="bg-[#3b82f6] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">R</div>
                <div className="bg-gray-800 rounded-lg p-3 flex-1">
                  <p className="text-gray-200">
                    Hi! I&apos;m REX. I can help you with resume rewrites, outreach scripts, interview prep, and more. What
                    would you like to work on?
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {rexPrompts.map((p) => (
                <button
                  key={p}
                  className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 hover:border-[#3b82f6] hover:text-[#3b82f6]"
                  onClick={() => goToRex(p)}
                >
                  {p.includes('resume') ? '📄' : p.includes('outreach') ? '✉️' : '🎯'} {p.split(' ')[0] === 'Help' ? p.replace('Help ', '') : p}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <input
                id="rex-input"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask REX anything about your job search..."
                className="flex-1 border border-gray-700 bg-gray-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#3b82f6] placeholder-gray-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
              />
              <button
                id="rex-send"
                className="bg-[#3b82f6] text-white px-6 py-3 rounded-lg hover:bg-blue-600"
                onClick={handleSend}
              >
                <FaEnvelope />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="py-20 bg-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">What can REX help with?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard icon={<FaRegFileAlt />} title="Resume rewrite" description="Transform your resume into a compelling story that hiring managers can't ignore." />
            <FeatureCard icon={<FaLinkedin />} title="LinkedIn rewrite" description="Optimize your LinkedIn profile to attract recruiters and showcase your value." />
            <FeatureCard icon={<FaEnvelope />} title="Outreach scripts" description="Craft personalized messages that get hiring managers to respond and engage." />
            <FeatureCard icon={<FaCrosshairs />} title="Hiring manager targeting" description="Find the right people to contact and learn how to approach them effectively." />
            <FeatureCard icon={<FaComments />} title="Interview prep" description="Practice answers, learn company insights, and prepare for any interview scenario." />
            <FeatureCard icon={<FaHandshake />} title="Negotiation coaching" description="Get the salary and benefits you deserve with proven negotiation strategies." />
          </div>
        </div>
      </section>

      {/* Credibility */}
      <section id="credibility" className="py-16 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <FaUserTie className="text-[#3b82f6] text-3xl mb-4 mx-auto" />
              <h4 className="font-semibold text-white mb-2">Built from real recruiter workflows</h4>
            </div>
            <div>
              <FaRocket className="text-[#3b82f6] text-3xl mb-4 mx-auto" />
              <h4 className="font-semibold text-white mb-2">Designed for direct outreach</h4>
            </div>
            <div>
              <FaStar className="text-[#3b82f6] text-3xl mb-4 mx-auto" />
              <h4 className="font-semibold text-white mb-2">"Finally something that doesn't just spam job boards."</h4>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-blue-50 text-gray-900">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-8">Simple, transparent pricing</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm">
              <h3 className="text-xl font-bold mb-4">Free</h3>
              <p className="text-gray-600 mb-6">Perfect to get started</p>
              <button className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold" onClick={handleStart}>
                Start Free
              </button>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg border-2" style={{ borderColor: primary }}>
              <h3 className="text-xl font-bold mb-4">Pro</h3>
              <p className="text-gray-600 mb-6">Upgrade for advanced features</p>
              <button
                className="w-full text-white py-3 rounded-lg font-semibold"
                style={{ background: primary }}
                onClick={() => navigate('/billing')}
              >
                Upgrade
              </button>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm">
              <h3 className="text-xl font-bold mb-4">Elite</h3>
              <p className="text-gray-600 mb-6">Includes custom domains</p>
              <button className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold" disabled>
                Coming Soon
              </button>
            </div>
          </div>
          <div className="mt-8">
            <button
              className="text-[#3b82f6] font-semibold hover:underline"
              onClick={() => navigate('/billing')}
            >
              See full pricing details →
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white text-center mb-16">Frequently asked questions</h2>
          <div className="space-y-8">
            <div className="border-b border-gray-700 pb-6">
              <h4 className="text-lg font-semibold text-white mb-2">Do you auto-apply to jobs?</h4>
              <p className="text-gray-300">
                No. We don&apos;t believe in it. HirePilot Jobs focuses on direct outreach to hiring managers, not mass applications.
              </p>
            </div>
            <div className="border-b border-gray-700 pb-6">
              <h4 className="text-lg font-semibold text-white mb-2">What makes this different?</h4>
              <p className="text-gray-300">
                Direct outreach playbook + REX coaching. We teach you the strategies recruiters use to connect candidates with opportunities.
              </p>
            </div>
            <div className="border-b border-gray-700 pb-6">
              <h4 className="text-lg font-semibold text-white mb-2">Do I need a resume already?</h4>
              <p className="text-gray-300">
                You can upload anything - even a basic resume or LinkedIn profile. REX will help you transform it into something powerful.
              </p>
            </div>
            <div className="border-b border-gray-700 pb-6">
              <h4 className="text-lg font-semibold text-white mb-2">Is this for executives or entry-level?</h4>
              <p className="text-gray-300">
                Both! Our targeting-based approach works for any level. REX adapts strategies based on your experience and goals.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-2">Does it work with LinkedIn?</h4>
              <p className="text-gray-300">
                Yes, we have a LinkedIn extension that helps you research prospects and send personalized outreach directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="final-cta" className="py-20 bg-gradient-to-r from-[#3b82f6] to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to transform your job search?</h2>
          <p className="text-xl mb-8 opacity-90">Stop applying. Start having conversations with hiring managers.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <button
              className="bg-white text-[#3b82f6] px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100"
              onClick={handleStart}
            >
              Start Free
            </button>
            <button
              className="border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white hover:text-[#3b82f6]"
              onClick={() => goToRex()}
            >
              Try REX Chat
            </button>
          </div>
          <p className="text-sm opacity-75">✨ Complete onboarding → earn bonus credits</p>
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="text-xl font-bold mb-4">HirePilot Jobs</div>
              <p className="text-gray-400">Stop applying. Start conversations.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#method" className="hover:text-white">How it works</a></li>
                <li><a href="#rex-preview" className="hover:text-white">REX Chat</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#faq" className="hover:text-white">Help Center</a></li>
                <li><a href="#faq" className="hover:text-white">Contact</a></li>
                <li><a href="#faq" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#hero" className="hover:text-white">About</a></li>
                <li><a href="#hero" className="hover:text-white">Blog</a></li>
                <li><a href="#hero" className="hover:text-white">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>© 2024 HirePilot Jobs. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
