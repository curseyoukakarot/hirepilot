import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BILLING_CONFIG } from '../../config/billingConfig';
import { JobSeekerPublicNav } from '../../components/jobseeker/JobSeekerPublicNav';
import PublicFooter from '../../components/PublicFooter';

type Interval = 'monthly' | 'annual';
type PaidPlanKey = 'pro' | 'elite';

export default function JobSeekerPricingPage() {
  const navigate = useNavigate();
  const [interval, setInterval] = useState<Interval>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const jobSeekerPlans = useMemo(() => BILLING_CONFIG.job_seeker, []);

  const priceIds = useMemo(
    () => ({
      pro: jobSeekerPlans.pro.priceIds,
      elite: jobSeekerPlans.elite.priceIds,
    }),
    [jobSeekerPlans]
  );

  const handleStartFree = useCallback(() => {
    navigate('/signup');
  }, [navigate]);

  const planIdMap: Record<'pro' | 'elite', string> = useMemo(
    () => ({
      pro: 'job_seeker_pro',
      elite: 'job_seeker_elite',
    }),
    []
  );

  const handleUpgrade = useCallback(
    async (planId: 'pro' | 'elite') => {
      try {
        setLoadingPlan(planId);
        const priceId = priceIds[planId]?.[interval];
        if (!priceId) {
          throw new Error(`Missing priceId for ${planId}/${interval}`);
        }
        const backendPlanId = planIdMap[planId] || planId;
        const successUrl = `${window.location.origin}/signup?plan=${planId}&interval=${interval}&checkout=success`;
        const cancelUrl = `${window.location.origin}/pricing?canceled=true`;
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/public-checkout/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            planId: backendPlanId,
            interval,
            price_id: priceId,
            success_url: successUrl,
            cancel_url: cancelUrl,
            plan_type: 'job_seeker',
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Checkout failed');
        }
        const { url } = await response.json();
        if (!url) throw new Error('Checkout session missing URL');
        window.location.href = url;
      } catch (e) {
        console.error('checkout error', e);
        alert(e?.message || 'Checkout failed');
      } finally {
        setLoadingPlan(null);
      }
    },
    [interval, planIdMap, priceIds]
  );

  const formatUsd = useCallback((amount: number) => {
    const hasCents = Math.round(amount * 100) % 100 !== 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: hasCents ? 2 : 0,
    }).format(amount);
  }, []);

  const planPrice = useCallback(
    (plan: PaidPlanKey, which: Interval) => {
      const val = jobSeekerPlans?.[plan]?.prices?.[which];
      return typeof val === 'number' ? val : 0;
    },
    [jobSeekerPlans]
  );

  const savingsBannerText = useMemo(() => {
    const plans: PaidPlanKey[] = ['pro', 'elite'];
    const maxSavings = plans.reduce((acc, p) => {
      const monthly = planPrice(p, 'monthly');
      const annual = planPrice(p, 'annual');
      const savings = monthly * 12 - annual;
      return Math.max(acc, savings);
    }, 0);
    const rounded = Math.max(0, Math.round(maxSavings));
    if (!rounded) return null;
    return `Save up to ${formatUsd(rounded)}/year`;
  }, [formatUsd, planPrice]);

  return (
    <div className="bg-gray-950 text-gray-100 font-inter min-h-screen">
      <div className="sticky top-0 z-50">
        <JobSeekerPublicNav variant="dark" />
      </div>

      <main>
        <section id="pricing-hero" className="bg-gray-900 pt-16 pb-12">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Choose how much leverage you want in your job search.
            </h1>
            <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
              Start free. Upgrade when you want more control, polish, and automation.
            </p>
          </div>
        </section>

        <section id="pricing-toggle" className="bg-gray-900 pb-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center">
              <div className="bg-gray-800 p-1 rounded-lg flex items-center text-sm">
                <button
                  id="monthly-btn"
                  className={`px-6 py-2 font-medium rounded-md ${
                    interval === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                  }`}
                  onClick={() => setInterval('monthly')}
                >
                  Monthly
                </button>
                <button
                  id="annual-btn"
                  className={`px-6 py-2 font-medium rounded-md ${
                    interval === 'annual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                  }`}
                  onClick={() => setInterval('annual')}
                >
                  Annual
                </button>
                {savingsBannerText && <span className="ml-3 text-sm text-green-400 font-medium">{savingsBannerText}</span>}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing-cards" className="bg-gray-950 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Free */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 relative">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">Free Forever</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-white">$0</span>
                    <span className="text-gray-400"> / month</span>
                  </div>
                  <p className="text-gray-400 mb-8">
                    Everything you need to start landing conversations and interviews — no credit card.
                  </p>
                </div>
                <div className="mb-8">
                  <h4 className="font-semibold text-white mb-4">Includes</h4>
                  <ul className="space-y-3 text-sm">
                    {[
                      'REX AI career assistant (chat anytime for search, strategy, and message ideas)',
                      'Chrome extension for LinkedIn research and contact discovery',
                      'Outreach from your own email inbox (Gmail, Outlook, etc.)',
                      'Bulk email outreach with starter limits so you can test campaigns safely',
                      'Apollo sourcing included for contact data on target companies and roles',
                      'LinkedIn & Sales Navigator sourcing support to find decision makers and referrers',
                      '50 credits/month included to power AI sourcing and outreach tasks',
                    ].map((item) => (
                      <li key={item} className="flex items-start">
                        <i className="fas fa-check text-green-400 mt-1 mr-3" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mb-8">
                  <h4 className="font-semibold text-white mb-3">Best for</h4>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>• Early-stage job seekers validating their story and target roles</li>
                    <li>• Exploring new roles without going all‑in yet</li>
                    <li>• Testing direct outreach and seeing if conversations start to open up</li>
                  </ul>
                </div>
                <button
                  className="w-full bg-gray-800 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors border border-gray-700"
                  onClick={handleStartFree}
                >
                  Start free
                </button>
              </div>

              {/* Pro */}
              <div className="bg-gray-900 border-2 border-blue-500 rounded-2xl p-8 relative shadow-xl shadow-blue-500/20">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">Most popular</span>
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">Job Seeker Pro</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-white">
                      {formatUsd(interval === 'monthly' ? planPrice('pro', 'monthly') : planPrice('pro', 'annual'))}
                    </span>
                    <span className="text-gray-400"> / {interval === 'monthly' ? 'month' : 'year'}</span>
                    <div className="text-sm text-gray-400 mt-1">
                      {interval === 'annual'
                        ? `Equivalent to ${formatUsd(planPrice('pro', 'annual') / 12)}/mo (billed annually)`
                        : `or ${formatUsd(planPrice('pro', 'annual'))}/yr billed annually`}
                    </div>
                  </div>
                  <p className="text-gray-400 mb-8">
                    Turn warm outreach into a polished professional presence that gets taken seriously.
                  </p>
                </div>
                <div className="mb-8">
                  <h4 className="font-semibold text-white mb-4">Everything in Free, plus</h4>
                  <ul className="space-y-3 text-sm">
                    {[
                      'Resume Builder (AI rewrite + scoring) to rebuild your resume in seconds with modern templates',
                      'Landing Page Builder (shareable portfolio/profile) to showcase projects, wins, and social proof',
                      'Resume and profile scoring & optimization to highlight strengths for specific roles',
                      'Job prep tools for interview practice, outreach refinement, and objection handling',
                      'Zapier integrations to plug HirePilot into your existing tools and workflows',
                      '250 credits/month included so you can scale targeted outreach each week',
                    ].map((item) => (
                      <li key={item} className="flex items-start">
                        <i className="fas fa-check text-green-400 mt-1 mr-3" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mb-8">
                  <h4 className="font-semibold text-white mb-3">Best for</h4>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>• Active job seekers running a serious, structured search</li>
                    <li>• Career pivots who need to reposition their story for a new function or industry</li>
                    <li>• Mid–senior professionals who want to look “recruiter-ready” on first contact</li>
                  </ul>
                </div>
                <button
                  className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                  onClick={() => handleUpgrade('pro')}
                  disabled={loadingPlan === 'pro'}
                >
                  {loadingPlan === 'pro' ? 'Starting checkout…' : 'Upgrade to Pro'}
                </button>
              </div>

              {/* Elite */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-yellow-500/30 rounded-2xl p-8 relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-yellow-500 text-gray-900 px-4 py-1 rounded-full text-sm font-medium">Recruiter Playbook</span>
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">Job Seeker Elite</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-white">
                      {formatUsd(interval === 'monthly' ? planPrice('elite', 'monthly') : planPrice('elite', 'annual'))}
                    </span>
                    <span className="text-gray-400"> / {interval === 'monthly' ? 'month' : 'year'}</span>
                    <div className="text-sm text-gray-400 mt-1">
                      {interval === 'annual'
                        ? `Equivalent to ${formatUsd(planPrice('elite', 'annual') / 12)}/mo (billed annually)`
                        : `or ${formatUsd(planPrice('elite', 'annual'))}/yr billed annually`}
                    </div>
                  </div>
                  <p className="text-gray-300 mb-8">
                    The full recruiter-grade job search system for people who want to run their search like a pipeline.
                  </p>
                </div>
                <div className="mb-8">
                  <h4 className="font-semibold text-white mb-4">Everything in Pro, plus</h4>
                  <ul className="space-y-3 text-sm">
                    {[
                      'Premium resume templates tuned for senior and executive roles',
                      'Premium landing page templates that feel like a personal “candidate microsite”',
                      'Custom domain (yourname.com) so your profile looks like a polished personal brand',
                      'White-labeled public landing page to share with recruiters, boards, and warm intros',
                      'Advanced automation & Agent Mode to let the system handle more sourcing and follow‑ups for you',
                      'Priority feature access and support so you’re first in line for new capabilities',
                      '500 credits/month included for sustained, multi-channel outreach in competitive markets',
                    ].map((item) => (
                      <li key={item} className="flex items-start">
                        <i className="fas fa-check text-yellow-400 mt-1 mr-3" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mb-8">
                  <h4 className="font-semibold text-white mb-3">Best for</h4>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>• Executives & founders who need a premium, on-brand search experience</li>
                    <li>• Highly competitive markets where differentiation and speed matter most</li>
                    <li>• People who want maximum leverage and to treat their search like a revenue pipeline</li>
                  </ul>
                </div>
                <button
                  className="w-full bg-yellow-500 text-gray-900 py-3 px-4 rounded-lg font-medium hover:bg-yellow-400 transition-colors"
                  onClick={() => handleUpgrade('elite')}
                  disabled={loadingPlan === 'elite'}
                >
                  {loadingPlan === 'elite' ? 'Starting checkout…' : 'Go Elite'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="feature-comparison" className="bg-gray-900 py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-white mb-12">Feature Comparison</h2>
            <div className="bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900">
                    <th className="text-left py-4 px-6 font-semibold text-white">Feature</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-400">Free</th>
                    <th className="text-center py-4 px-6 font-semibold text-blue-400">Pro</th>
                    <th className="text-center py-4 px-6 font-semibold text-yellow-400">Elite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {[
                    ['REX AI Assistant', true, true, true],
                    ['Chrome Extension', true, true, true],
                    ['Outreach from Email', true, true, true],
                    ['Resume Builder', false, true, true],
                    ['Landing Page Builder', false, true, true],
                    ['Resume Scoring', false, true, true],
                    ['Templates', false, false, true],
                    ['Agent Mode', false, false, true],
                  ].map(([feature, free, pro, elite]) => (
                    <tr key={feature as string} className="bg-opacity-50">
                      <td className="py-4 px-6 font-medium text-white">{feature}</td>
                      {[free, pro, elite].map((val, idx) => (
                        <td key={idx} className="text-center py-4 px-6">
                          {val ? <i className="fas fa-check text-green-400" /> : <i className="fas fa-times text-gray-600" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="philosophy-section" className="bg-gray-900 py-16">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white mb-8">Our Philosophy</h2>
            <div className="text-lg text-gray-400 leading-relaxed max-w-3xl mx-auto space-y-6">
              <p>HirePilot doesn&apos;t spam job boards or auto-apply for you.</p>
              <p>
                We help you position yourself correctly, reach decision-makers directly, and run the same playbook recruiters use — ethically and
                effectively.
              </p>
            </div>
          </div>
        </section>

        <section id="cta-section" className="bg-blue-500 py-16">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to transform your job search?</h2>
            <p className="text-xl text-blue-100 mb-8">Start with our Free Forever plan. No credit card required.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                className="bg-white text-blue-500 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                onClick={handleStartFree}
              >
                Start Free
              </button>
              <button
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-medium hover:bg-white hover:text-blue-500 transition-colors"
                onClick={() => navigate('/prep/rex-chat')}
              >
                View Demo
              </button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
