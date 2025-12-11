import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FaArrowLeft,
  FaBriefcase,
  FaBuilding,
  FaCalendarDays,
  FaChartLine,
  FaClipboardList,
  FaLocationDot,
  FaMoneyBillWave,
  FaPhone,
} from 'react-icons/fa6';

type JobStatus = 'Saved' | 'Applied' | 'Interviewing' | 'Offer' | 'Closed';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  jobType: string;
  status: JobStatus;
  lastContact: string;
  interviews: number;
  notes: string;
  description: string;
};

const jobData: Job[] = [
  {
    id: 'job-1',
    title: 'Head of Sales',
    company: 'Nimbus Data',
    location: 'Remote · US',
    salary: '$180k–$220k + bonus',
    jobType: 'Full-time',
    status: 'Interviewing',
    lastContact: '3d ago',
    interviews: 2,
    notes: 'Panel with CRO next week. Prep GTM playbook examples and outbound metrics.',
    description:
      'Lead sales org for a fast-growing data platform. Own GTM strategy, outbound engine, and enterprise expansion. Build and mentor a distributed team.',
  },
  {
    id: 'job-2',
    title: 'VP Sales',
    company: 'CloudSync',
    location: 'San Francisco, CA',
    salary: '$200k–$240k + equity',
    jobType: 'Hybrid',
    status: 'Applied',
    lastContact: '5d ago',
    interviews: 0,
    notes: 'Tailored resume sent. Follow up with recruiter by Friday.',
    description: 'Scale mid-market to enterprise motion. Stand up enablement and refine pipeline velocity.',
  },
  {
    id: 'job-3',
    title: 'Director of Sales',
    company: 'Pipeline Labs',
    location: 'Remote · US',
    salary: '$160k–$190k',
    jobType: 'Full-time',
    status: 'Saved',
    lastContact: '—',
    interviews: 0,
    notes: 'Add case study to cover letter. Strong fit for outbound leadership.',
    description: 'Own outbound strategy and team development for a modern sales tooling company.',
  },
];

const statusClasses: Record<JobStatus, string> = {
  Saved: 'bg-slate-800 text-slate-200 border-slate-700',
  Applied: 'bg-blue-500/15 text-blue-200 border-blue-400/40',
  Interviewing: 'bg-amber-500/15 text-amber-200 border-amber-400/40',
  Offer: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40',
  Closed: 'bg-slate-800 text-slate-400 border-slate-700',
};

export default function JobSeekerJobDetailPage() {
  const { id } = useParams();
  const job = useMemo(() => jobData.find((j) => j.id === id) || jobData[0], [id]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm"
          >
            <FaArrowLeft />
            Back to jobs
          </Link>
        </div>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${statusClasses[job.status]}`}
        >
          <FaBriefcase className="text-[12px]" />
          {job.status}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300 mt-2">
              <span className="inline-flex items-center gap-2">
                <FaBuilding className="text-slate-500" />
                {job.company}
              </span>
              <span className="inline-flex items-center gap-2">
                <FaLocationDot className="text-slate-500" />
                {job.location}
              </span>
              <span className="inline-flex items-center gap-2">
                <FaMoneyBillWave className="text-slate-500" />
                {job.salary}
              </span>
              <span className="inline-flex items-center gap-2">
                <FaClipboardList className="text-slate-500" />
                {job.jobType}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <div className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
              <div className="text-sm text-slate-200 font-semibold">{job.interviews}</div>
              <div className="text-[11px] text-slate-500">Interviews</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
              <div className="text-sm text-slate-200 font-semibold">{job.lastContact}</div>
              <div className="text-[11px] text-slate-500">Last contact</div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-slate-300 leading-relaxed">{job.description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Notes</h3>
          <p className="text-slate-300 text-sm leading-relaxed">{job.notes}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Your application</h3>
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Status</span>
            <span className="font-semibold text-slate-100">{job.status}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Last contact</span>
            <span className="flex items-center gap-2 text-slate-200">
              <FaPhone className="text-slate-500" />
              {job.lastContact}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Interviews</span>
            <span className="flex items-center gap-2 text-slate-200">
              <FaChartLine className="text-slate-500" />
              {job.interviews}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Job type</span>
            <span className="text-slate-200">{job.jobType}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Comp range</span>
            <span className="text-slate-200">{job.salary}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
