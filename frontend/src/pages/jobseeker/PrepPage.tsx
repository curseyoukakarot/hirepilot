import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaBriefcase,
  FaFileLines,
  FaChartLine,
  FaGlobe,
  FaComments,
  FaStar,
  FaPlus,
  FaUpload,
  FaWandMagicSparkles,
  FaRocket,
} from 'react-icons/fa6';

export default function PrepPage() {
  const navigate = useNavigate();

  const goToRexAnalyze = () => {
    const prompt =
      "REX, will you take a look at my resume and analyze it? Give me feedback on the format, keywords, and anything I should optimize. Then grade it out of 100. If I haven't attached a resume yet, ask me to upload it.";
    navigate(`/prep/rex-chat?prefill=${encodeURIComponent(prompt)}`);
  };
  return (
    <div id="prep-page" className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8 text-slate-100">
      {/* Header Section */}
      <div id="prep-header" className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-xs font-medium text-slate-300 mb-4">
          <FaBriefcase className="text-sky-400" />
          <span>Prep Center · Powered by REX</span>
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3">Prep your professional presence</h1>
        <p className="text-lg text-slate-400 max-w-3xl">
          Tune your resume, LinkedIn, and landing page so every application lands with impact.
        </p>
      </div>

      {/* Pill Navigation */}
      <div id="prep-nav" className="mt-4 mb-6 flex flex-wrap gap-2">
        <Link
          to="/prep/resume/wizard"
          className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-500 hover:text-sky-100 hover:bg-slate-900 transition"
        >
          <FaFileLines />
          <span>Resume Wizard</span>
        </Link>
        <button
          onClick={goToRexAnalyze}
          className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-500 hover:text-sky-100 hover:bg-slate-900 transition"
        >
          <FaChartLine />
          <span>Resume Parser</span>
        </button>
        <Link
          to="/prep/landing-page"
          className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-500 hover:text-sky-100 hover:bg-slate-900 transition"
        >
          <FaGlobe />
          <span>Landing Page Builder</span>
        </Link>
        <Link
          to="/prep/rex-chat"
          className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-500 hover:text-sky-100 hover:bg-slate-900 transition"
        >
          <FaComments />
          <span>REX Job Prep Chat</span>
        </Link>
      </div>

      {/* Main Cards Grid */}
      <div id="prep-tools-grid" className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Resume Builder Card */}
          <div
            id="resume-builder-card"
            className="relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500/20">
                  <FaFileLines className="text-sky-400 text-xl" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Resume Builder</h3>
                  <p className="text-sm text-slate-400">AI-powered resume creation</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-1 text-xs font-medium text-sky-300">
                <FaStar />
                <span>Most Popular</span>
              </div>
            </div>

            <p className="text-slate-300 mb-4">
              Build professional resumes with AI assistance. Choose from modern templates and get real-time suggestions to
              make your experience shine.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-lg bg-slate-800/50 p-3">
                <div className="text-sm font-medium text-white mb-1">Templates</div>
                <div className="text-xs text-slate-400">15+ modern designs</div>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-3">
                <div className="text-sm font-medium text-white mb-1">AI Suggestions</div>
                <div className="text-xs text-slate-400">Smart content tips</div>
              </div>
            </div>

            <Link
              to="/prep/resume/wizard"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-3 text-sm font-medium text-white hover:bg-sky-600 transition"
            >
              <FaPlus />
              <span>Create Resume (1-Click)</span>
            </Link>
            <Link
              to="/prep/resume/builder"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-medium text-slate-200 hover:border-sky-500 transition"
            >
              <FaPlus />
              <span>Open Builder</span>
            </Link>
            <Link
              to="/prep/resume/templates"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-200 hover:border-indigo-500 transition"
            >
              <FaStar />
              <span>Browse Templates (Elite)</span>
            </Link>
          </div>

          {/* Resume Parser Card wired to REX chat */}
          <div
            id="resume-parser-card"
            className="relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/20">
                  <FaChartLine className="text-emerald-400 text-xl" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Resume Parser &amp; Score</h3>
                  <p className="text-sm text-slate-400">Analyze and optimize with REX</p>
                </div>
              </div>
            </div>

            <p className="text-slate-300 mb-4">
              Ask REX to review your resume, give format/keyword feedback, and grade it out of 100. If no resume is
              attached, REX will prompt you to upload it.
            </p>

            <button
              onClick={goToRexAnalyze}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-600 transition"
            >
              <FaUpload />
              <span>Analyze with REX</span>
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Landing Page Builder Card */}
          <div
            id="landing-page-card"
            className="relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/20">
                  <FaGlobe className="text-purple-400 text-xl" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Landing Page Builder</h3>
                  <p className="text-sm text-slate-400">Personal portfolio site</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-300">
                <FaWandMagicSparkles />
                <span>New</span>
              </div>
            </div>

            <p className="text-slate-300 mb-4">
              Create a stunning personal website that showcases your skills, projects, and professional journey.
            </p>

            {/* Mini Preview */}
            <div className="rounded-lg bg-slate-800/50 p-4 mb-4">
              <div className="text-xs text-slate-400 mb-2">Preview</div>
              <div className="space-y-2">
                <div className="h-2 bg-slate-700 rounded w-3/4" />
                <div className="h-1 bg-slate-700 rounded w-1/2" />
                <div className="flex gap-2">
                  <div className="h-8 w-8 bg-slate-700 rounded" />
                  <div className="flex-1">
                    <div className="h-1 bg-slate-700 rounded w-full mb-1" />
                    <div className="h-1 bg-slate-700 rounded w-2/3" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="text-center p-2 rounded bg-slate-800/30">
                <div className="text-xs font-medium text-white">Templates</div>
                <div className="text-xs text-slate-400">10+</div>
              </div>
              <div className="text-center p-2 rounded bg-slate-800/30">
                <div className="text-xs font-medium text-white">Custom Domain</div>
                <div className="text-xs text-slate-400">Available</div>
              </div>
            </div>

            <Link
              to="/prep/landing-page"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-3 text-sm font-medium text-white hover:bg-purple-600 transition"
            >
              <FaRocket />
              <span>Create Site</span>
            </Link>
            <Link
              to="/prep/landing/themes"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-200 hover:border-indigo-500 transition"
            >
              <FaStar />
              <span>Browse Themes (Elite)</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
