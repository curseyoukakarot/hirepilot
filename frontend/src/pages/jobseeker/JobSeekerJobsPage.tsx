import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FaBriefcase, FaBuilding, FaLocationDot, FaMoneyBillWave, FaRegClock } from 'react-icons/fa6';

type JobStatus = 'Saved' | 'Applied' | 'Interviewing' | 'Offer' | 'Closed';

type JobCard = {
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
};

const sampleJobs: JobCard[] = [
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
    notes: 'Panel scheduled next week. Emphasize GTM playbooks + MEDDIC.',
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
    notes: 'Applied with tailored resume. Waiting for recruiter response.',
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
    notes: 'Focus on outbound leadership; add case study to cover letter.',
  },
];

const statusClasses: Record<JobStatus, string> = {
  Saved: 'bg-slate-800 text-slate-200 border-slate-700',
  Applied: 'bg-blue-500/15 text-blue-200 border-blue-400/40',
  Interviewing: 'bg-amber-500/15 text-amber-200 border-amber-400/40',
  Offer: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40',
  Closed: 'bg-slate-800 text-slate-400 border-slate-700',
};

export default function JobSeekerJobsPage() {
  const jobs = useMemo(() => sampleJobs, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">My Jobs</p>
          <h1 className="text-3xl font-bold text-white">Saved jobs & applications</h1>
          <p className="text-slate-400 mt-1">Track your current applications and prep for the next steps.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
          <FaRegClock />
          <span>Updated just now</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {jobs.map((job) => (
          <Link
            key={job.id}
            to={`/jobs/${job.id}`}
            className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-5 hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xl font-semibold text-white">{job.title}</h3>
                <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                  <FaBuilding className="text-slate-500" />
                  <span>{job.company}</span>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${statusClasses[job.status]}`}
              >
                <FaBriefcase className="text-[12px]" />
                {job.status}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-slate-300 mb-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700">
                <FaLocationDot className="text-slate-400" />
                {job.location}
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700">
                <FaMoneyBillWave className="text-slate-400" />
                {job.salary}
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700">
                {job.jobType}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs text-slate-400 mb-3">
              <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
                <div className="text-slate-300 text-sm font-semibold">{job.interviews}</div>
                <div className="text-[11px] text-slate-500">Interviews</div>
              </div>
              <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
                <div className="text-slate-300 text-sm font-semibold">{job.lastContact}</div>
                <div className="text-[11px] text-slate-500">Last contact</div>
              </div>
              <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
                <div className="text-slate-300 text-sm font-semibold">Stage</div>
                <div className="text-[11px] text-slate-500">{job.status}</div>
              </div>
            </div>

            <p className="text-sm text-slate-400 line-clamp-2">{job.notes}</p>

            <div className="mt-4 inline-flex items-center gap-2 text-sm text-sky-300">
              <span>View details</span>
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
