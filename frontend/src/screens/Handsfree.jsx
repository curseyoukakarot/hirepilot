import React, { useEffect } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function Handsfree() {
  useEffect(()=>{
    const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target);}})},{threshold:.15});
    document.querySelectorAll('.fade-in').forEach(el=>io.observe(el));
    return ()=>io.disconnect();
  },[]);
  return (
    <div className="h-full text-base-content">
      <div id="main" className="min-h-screen bg-gray-900 text-white">
        <style>{`.fade-in{opacity:0;transform:translateY(12px);transition:opacity .6s ease,transform .6s ease}.fade-in.in-view{opacity:1;transform:none}`}</style>
        {/* Header */}
        <PublicNavbar />

        {/* Hero Section */}
        <section id="hero" className="pt-32 pb-20 bg-gradient-to-b from-blue-900 via-blue-800 to-gray-900 fade-in">
          <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col items-center justify-center gap-12">
            <div className="w-full max-w-3xl text-center">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight text-white">
                We Find.<br />You Interview.
              </h1>
              <p className="mt-6 text-xl text-gray-200">
                With our Done For You service, we handle all the heavy lifting — sourcing, outreach, and scheduling — so you can just show up to interviews with top-tier candidates, ready to hire.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:justify-start justify-center">
                <a href="https://form.typeform.com/to/UubjS8Rh" target="_blank" rel="noopener" className="bg-white text-blue-700 font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-white/25 transition-all duration-200">
                  <i className="fa-regular fa-calendar-check mr-2"></i>
                  Schedule Free Consultation
                </a>
                <a href="/pricing" className="bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:bg-blue-600 transition-all duration-200">
                  Get Started Free
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* DFY Dashboard Showcase Section */}
        <section id="dfy-dashboard-showcase" className="relative fade-in">
          <div className="w-full">
            {/* Full-bleed gradient area with big screenshot */}
            <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] bg-gradient-to-b from-blue-900 via-blue-700 to-gray-900">
              <div className="max-w-7xl mx-auto px-6 pt-20 pb-10 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Everything You Need to Hire Fast</h2>
                <p className="text-blue-100/90 max-w-2xl mx-auto mb-10">Track sourcing, collaboration, and success rates in one dashboard.</p>
                <div className="flex justify-center">
                  <img
                    src="/dfy-dashboard.png"
                    alt="Client Dashboard"
                    className="w-[100%] md:w-[100%] lg:w-[100%] max-w-6xl rounded-2xl shadow-2xl border border-white/10"
                  />
                </div>
              </div>
            </div>

            {/* Context cards on white background */}
            <div className="bg-gray-900">
              <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex gap-4 items-start bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <i className="fa-solid fa-box-open text-blue-600 text-2xl"></i>
                    <div>
                      <h4 className="font-semibold text-lg text-white">Full-Service Sourcing</h4>
                      <p className="text-gray-300">You send us the job. We find and engage top candidates.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <i className="fa-solid fa-users text-blue-600 text-2xl"></i>
                    <div>
                      <h4 className="font-semibold text-lg text-white">Unlimited Team Access</h4>
                      <p className="text-gray-300">Invite hiring managers, ops, and execs to collaborate.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <i className="fa-brands fa-slack text-blue-600 text-2xl"></i>
                    <div>
                      <h4 className="font-semibold text-lg text-white">Slack-first Collaboration</h4>
                      <p className="text-gray-300">Review candidates and track status inside Slack.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <i className="fa-solid fa-plug text-blue-600 text-2xl"></i>
                    <div>
                      <h4 className="font-semibold text-lg text-white">ATS Integration</h4>
                      <p className="text-gray-300">Seamlessly sync with your hiring stack.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <i className="fa-regular fa-calendar-check text-blue-600 text-2xl"></i>
                    <div>
                      <h4 className="font-semibold text-lg text-white">Calendar-Ready Interviews</h4>
                      <p className="text-gray-300">Just show up. We schedule every call for you.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section id="process" className="py-20 bg-gray-900 fade-in">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-4 text-white">How It Works</h2>
            <p className="text-gray-300 mb-12 max-w-2xl mx-auto">From kickoff to interviews — we handle every step of the sourcing process.</p>

            <div className="grid md:grid-cols-3 gap-10">
              <div id="step-1" className="bg-gray-800 p-8 rounded-xl shadow-md relative border border-gray-700">
                <div className="w-14 h-14 mx-auto mb-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">1</div>
                <h4 className="font-semibold text-xl mb-3 text-white">Kickoff Call</h4>
                <p className="text-gray-300">We align on your goals, culture, and ideal candidate profile.</p>
                <div className="absolute top-1/2 right-0 hidden md:block">
                  <i className="fa-solid fa-arrow-right text-blue-200 text-4xl transform translate-x-1/2"></i>
                </div>
              </div>

              <div id="step-2" className="bg-gray-800 p-8 rounded-xl shadow-md relative border border-gray-700">
                <div className="w-14 h-14 mx-auto mb-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">2</div>
                <h4 className="font-semibold text-xl mb-3 text-white">We Source &amp; Engage</h4>
                <p className="text-gray-300">Our recruiters + AI handle outreach to find perfect matches.</p>
                <div className="absolute top-1/2 right-0 hidden md:block">
                  <i className="fa-solid fa-arrow-right text-blue-200 text-4xl transform translate-x-1/2"></i>
                </div>
              </div>

              <div id="step-3" className="bg-gray-800 p-8 rounded-xl shadow-md border border-gray-700">
                <div className="w-14 h-14 mx-auto mb-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">3</div>
                <h4 className="font-semibold text-xl mb-3 text-white">You Interview</h4>
                <p className="text-gray-300">Qualified candidates show up on your calendar.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-20 bg-gray-900 fade-in">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4 text-white">Real Results</h2>
              <p className="text-gray-300 max-w-2xl mx-auto">See what our clients say about their hiring success</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div id="testimonial-1" className="bg-gray-800 p-8 rounded-xl border border-gray-700">
                <div className="flex items-center gap-4 mb-6">
                  <div>
                    <h4 className="font-semibold">Michael C.</h4>
                    <p className="text-gray-600">CTO</p>
                  </div>
                </div>
                <p className="text-lg text-gray-300">"In 30 days, we filled 3 roles — all scheduled on my calendar. Easiest hires I've ever made."</p>
              </div>

              <div id="testimonial-2" className="bg-gray-800 p-8 rounded-xl border border-gray-700">
                <div className="flex items-center gap-4 mb-6">
                  <div>
                    <h4 className="font-semibold">Sarah W.</h4>
                    <p className="text-gray-600">Head of Talent</p>
                  </div>
                </div>
                <p className="text-lg text-gray-300">"Their team became an extension of ours. The quality of candidates and speed of hiring exceeded our expectations."</p>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section id="comparison" className="py-20 bg-gray-900 fade-in">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-12 text-white">Compare Our Solutions</h2>

            <div className="overflow-hidden bg-gray-800 rounded-xl shadow-lg border border-gray-700">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900">
                    <th className="p-4 text-left text-white">Feature</th>
                    <th className="p-4 text-center text-white">Core HirePilot Service</th>
                    <th className="p-4 text-center bg-blue-900 text-white">Done For You Hiring</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-700">
                    <td className="p-4 text-gray-300">You manage sourcing</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-check text-green-500"></i></td>
                    <td className="p-4 text-center bg-blue-900"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                  </tr>
                  <tr className="border-t border-gray-700">
                    <td className="p-4 text-gray-300">We manage sourcing</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                    <td className="p-4 text-center bg-blue-900"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                  <tr className="border-t border-gray-700">
                    <td className="p-4 text-gray-300">AI Messaging</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-check text-green-500"></i></td>
                    <td className="p-4 text-center bg-blue-900"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                  <tr className="border-t border-gray-700">
                    <td className="p-4 text-gray-300">Human recruiters</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                    <td className="p-4 text-center bg-blue-900"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                  <tr className="border-t border-gray-700">
                    <td className="p-4 text-gray-300">Slack support</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                    <td className="p-4 text-center bg-blue-900"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                  <tr className="border-t border-gray-700">
                    <td className="p-4 text-gray-300">ATS Sync</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                    <td className="p-4 text-center bg-blue-900"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                  <tr className="border-t border-gray-700">
                    <td className="p-4 text-gray-300">Calendar Scheduling</td>
                    <td className="p-4 text-center"><i className="fa-solid fa-xmark text-gray-400"></i></td>
                    <td className="p-4 text-center bg-blue-900"><i className="fa-solid fa-check text-green-500"></i></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="cta" className="py-20 bg-blue-800 text-white fade-in">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold mb-6">Let us run your recruiting process — while you focus on closing the best candidates.</h2>
            <p className="text-xl mb-10 opacity-90">Book a consultation or view candidate samples to get started today.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="https://form.typeform.com/to/UubjS8Rh" target="_blank" rel="noopener" className="bg-white text-blue-600 font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200">
                <i className="fa-regular fa-calendar mr-2"></i>
                Book Consultation
              </a>
              <a href="/pricing" className="border-2 border-white text-white font-semibold py-4 px-8 rounded-lg hover:bg-white/10 transition-colors duration-200">
                Get Started Free
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