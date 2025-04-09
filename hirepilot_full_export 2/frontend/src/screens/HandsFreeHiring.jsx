import React from "react";
import { Link } from "react-router-dom";

const HandsFreeHiring = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-blue-500 via-blue-200 to-white">
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="w-full md:w-1/2 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight text-gray-900">
              We Find. You Interview.
            </h1>
            <p className="mt-6 text-lg text-gray-800">
              Let us handle sourcing, outreach, and scheduling — you just show up to the interviews.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:justify-start justify-center">
              <Link to="/consultation" className="bg-white text-blue-600 font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-white/25 transition-all duration-200">
                Schedule Free Consultation
              </Link>
              <Link to="/samples" className="bg-blue-900 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:bg-blue-800 transition-all duration-200">
                View Sample Candidates
              </Link>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <div className="rounded-xl overflow-hidden shadow-xl">
              <img src="/images/calendar-filled.png" alt="Calendar auto-scheduling UI" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-semibold text-center mb-12">What You Get</h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <i className="fa-solid fa-briefcase text-blue-600 text-2xl"></i>
                <div>
                  <h4 className="font-semibold text-lg">Full-Service Sourcing</h4>
                  <p className="text-gray-600">You send us the job. We find and engage top candidates.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <i className="fa-solid fa-users text-blue-600 text-2xl"></i>
                <div>
                  <h4 className="font-semibold text-lg">Unlimited Team Access</h4>
                  <p className="text-gray-600">Invite your hiring managers, founders, and execs to review and collaborate.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <i className="fa-brands fa-slack text-blue-600 text-2xl"></i>
                <div>
                  <h4 className="font-semibold text-lg">Slack Collaboration</h4>
                  <p className="text-gray-600">We’ll send candidates, get feedback, and chat with your team directly in Slack.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <i className="fa-solid fa-plug text-blue-600 text-2xl"></i>
                <div>
                  <h4 className="font-semibold text-lg">ATS Integration</h4>
                  <p className="text-gray-600">We connect to your existing stack: Greenhouse, Lever, or your internal tools.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <i className="fa-regular fa-calendar-check text-blue-600 text-2xl"></i>
                <div>
                  <h4 className="font-semibold text-lg">Calendar-Ready Interviews</h4>
                  <p className="text-gray-600">No back-and-forth — we book interviews directly to your calendar.</p>
                </div>
              </div>
            </div>
            <div>
              <img src="/images/slack-feedback.png" alt="Slack candidate review" className="rounded-xl shadow-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-semibold mb-4">How It Works</h2>
          <p className="text-gray-600 mb-12 max-w-2xl mx-auto">From kickoff to interviews — we handle every step of the sourcing process.</p>
          <div className="grid md:grid-cols-3 gap-10">
            <div className="bg-white p-8 rounded-xl shadow-md">
              <div className="w-14 h-14 mx-auto mb-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">1</div>
              <h4 className="font-semibold mb-2">Kickoff Call</h4>
              <p className="text-gray-600">We align on your goals, culture, and ideal candidate profile.</p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-md">
              <div className="w-14 h-14 mx-auto mb-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">2</div>
              <h4 className="font-semibold mb-2">We Source & Engage</h4>
              <p className="text-gray-600">Our team and AI agents find and contact candidates that match your needs.</p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-md">
              <div className="w-14 h-14 mx-auto mb-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">3</div>
              <h4 className="font-semibold mb-2">You Interview</h4>
              <p className="text-gray-600">Pre-vetted candidates land directly on your calendar for final review.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Let us run your recruiting process — while you focus on closing the best candidates.</h2>
          <p className="text-xl mb-10 opacity-90">Book a consultation or view candidate samples to get started today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/consultation" className="bg-white text-blue-600 font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200">
              Book Consultation <i className="fa-solid fa-arrow-right ml-2"></i>
            </Link>
            <Link to="/samples" className="border-2 border-white text-white font-semibold py-4 px-8 rounded-lg hover:bg-white/10 transition-colors duration-200">
              View Candidates
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HandsFreeHiring;
