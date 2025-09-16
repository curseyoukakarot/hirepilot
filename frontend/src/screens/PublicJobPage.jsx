import React from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function PublicJobPage() {
  const { shareId } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [job, setJob] = React.useState(null);
  const [applying, setApplying] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    linkedin: '',
    resume_url: '',
    cover_note: ''
  });

  const backend = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  React.useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${backend}/api/public/jobs/${shareId}`);
        const js = await resp.json();
        if (resp.ok) { 
          setJob(js.job); 
        } else {
          console.error('Failed to fetch job:', js.error);
        }
      } catch (error) {
        console.error('Error fetching job:', error);
      } finally { 
        setLoading(false); 
      }
    })();
  }, [shareId]);

  const handleApply = async (e) => {
    e.preventDefault();
    if (!job || applying) return;

    if (!form.name || !form.email) {
      toast.error('Please fill in your name and email');
      return;
    }

    setApplying(true);
    try {
      const resp = await fetch(`${backend}/api/public/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          share_id: shareId, 
          ...form 
        }),
      });

      const result = await resp.json();
      
      if (resp.ok) {
        toast.success('✅ Application submitted successfully!');
        setForm({ name: '', email: '', linkedin: '', resume_url: '', cover_note: '' });
      } else {
        toast.error(`❌ ${result.error || 'Failed to submit application'}`);
      }
    } catch (error) {
      console.error('Application error:', error);
      toast.error('❌ Failed to submit application. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const openLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener');
  };
  const openTwitter = () => {
    const text = encodeURIComponent(`We're hiring: ${job?.title} — ${shareUrl}`);
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(url, '_blank', 'noopener');
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading…</div>;
  if (!job) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Job not found.</div>;

  const statusPill = (job.status || '').toLowerCase() === 'open' ? 'Now Hiring' : (job.status || '');

  return (
    <div id="public-job-page" className="bg-gray-50 text-gray-800 min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 flex items-center space-x-2">
                <img src="/logo.png" alt="HirePilot" className="h-8 w-8" />
                <span className="font-bold text-xl text-gray-800">HirePilot</span>
              </div>
              <div className="hidden md:flex items-center space-x-3 border-l border-gray-200 pl-4">
                <h2 className="text-lg font-semibold text-gray-700 truncate">{job.title}</h2>
                {statusPill && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{statusPill}</span>
                )}
              </div>
            </div>
            <div className="hidden md:block">
              <button 
                onClick={() => document.getElementById('apply-form').scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-400 transition-all duration-300 transform hover:scale-105 cursor-pointer"
              >
                Apply Now
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero */}
        <section className="pb-12 border-b border-gray-200">
          <div className="flex flex-col space-y-2 md:hidden mb-4">
            {statusPill && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 w-fit"><i className="fa-solid fa-check-circle mr-2"></i>{statusPill}</span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">{job.title}</h1>
          <p className="mt-2 text-xl text-gray-600">{[job.company, job.location].filter(Boolean).join(' · ')}</p>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-purple-700 text-2xl mb-2"><i className="fa-solid fa-building"></i></div>
              <p className="text-sm text-gray-500">Department</p>
              <p className="font-semibold text-gray-800">{job.department || '—'}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-purple-700 text-2xl mb-2"><i className="fa-solid fa-graduation-cap"></i></div>
              <p className="text-sm text-gray-500">Experience</p>
              <p className="font-semibold text-gray-800">{job.experience_level || '—'}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-purple-700 text-2xl mb-2"><i className="fa-solid fa-sack-dollar"></i></div>
              <p className="text-sm text-gray-500">Salary Range</p>
              <p className="font-semibold text-gray-800">{job.salary_range || '—'}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-purple-700 text-2xl mb-2"><i className="fa-solid fa-briefcase"></i></div>
              <p className="text-sm text-gray-500">Work Type</p>
              <p className="font-semibold text-gray-800">{job.work_type || (String(job.location||'').toLowerCase().includes('remote') ? 'Remote' : 'Onsite')}</p>
            </div>
          </div>
        </section>

        {/* Body */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 lg:gap-12">
          {/* Left */}
          <div className="lg:col-span-2">
            <section className="prose prose-lg max-w-none text-gray-600">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Role Description</h2>
              <div className="whitespace-pre-line">{job.description || 'No description provided.'}</div>
            </section>

            {job.why_join && (
              <section className="mt-12 pt-8 border-t border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Why Join Us?</h2>
                <div className="prose prose-lg max-w-none text-gray-600 whitespace-pre-line">{job.why_join}</div>
              </section>
            )}

            {/* Application Form */}
            <section id="apply-form" className="mt-12 pt-8 border-t border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Apply for this Position</h2>
              <form onSubmit={handleApply} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your email address"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">LinkedIn Profile</label>
                    <input
                      type="url"
                      value={form.linkedin}
                      onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="https://linkedin.com/in/yourprofile"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Resume URL</label>
                    <input
                      type="url"
                      value={form.resume_url}
                      onChange={(e) => setForm({ ...form, resume_url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="https://drive.google.com/your-resume.pdf"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cover Note</label>
                  <textarea
                    value={form.cover_note}
                    onChange={(e) => setForm({ ...form, cover_note: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Tell us why you're interested in this position..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={applying}
                  className="w-full md:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-400 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {applying ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane mr-2"></i>
                      Submit Application
                    </>
                  )}
                </button>
              </form>
            </section>
          </div>

          {/* Right */}
          <aside className="mt-12 lg:mt-0">
            <div className="sticky top-24 space-y-8">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm text-center">
                <h3 className="text-xl font-bold text-gray-900">Ready to make an impact?</h3>
                <p className="text-gray-600 mt-2 mb-6">Apply now to join our team and help shape the future.</p>
                <button 
                  onClick={() => document.getElementById('apply-form').scrollIntoView({ behavior: 'smooth' })}
                  className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-400 transition-all duration-300 transform hover:scale-105 shadow-lg cursor-pointer"
                >
                  <i className="fa-solid fa-paper-plane mr-2"></i>
                  Apply Now
                </button>
              </div>

              {(job.recruiter_name || job.recruiter_email) && (
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Recruiter</h3>
                  <div className="flex items-center space-x-4">
                    <img className="h-16 w-16 rounded-full object-cover" src={job.recruiter_avatar || 'https://ui-avatars.com/api/?name=Recruiter&background=random'} alt="Recruiter Avatar" />
                    <div>
                      <p className="font-bold text-gray-800">{job.recruiter_name || 'Recruiter'}</p>
                      {job.recruiter_title && <p className="text-sm text-gray-500">{job.recruiter_title}</p>}
                      {job.recruiter_linkedin && (
                        <a href={job.recruiter_linkedin} target="_blank" rel="noreferrer" className="text-sm text-purple-700 hover:underline">
                          <i className="fa-brands fa-linkedin mr-1"></i> LinkedIn Profile
                        </a>
                      )}
                    </div>
                  </div>
                  {job.recruiter_email && (
                    <a href={`mailto:${job.recruiter_email}`} className="mt-5 block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md transition">Questions? Reach out</a>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3 text-gray-500">
            <span>Powered by</span>
            <a href="/" className="flex items-center gap-2 font-bold text-gray-700 hover:text-purple-700 transition">
              <img src="/logo.png" alt="HirePilot" className="h-6 w-6" />
              <span>HirePilot</span>
            </a>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600 font-medium">Share this job:</span>
            <button onClick={openLinkedIn} className="text-gray-400 hover:text-blue-700 transition cursor-pointer" aria-label="Share on LinkedIn"><i className="fa-brands fa-linkedin fa-2x"></i></button>
            <button onClick={openTwitter} className="text-gray-400 hover:text-blue-400 transition cursor-pointer" aria-label="Share on Twitter"><i className="fa-brands fa-twitter fa-2x"></i></button>
          </div>
        </div>
      </footer>

      {/* Sticky Apply for mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-30">
        <button 
          onClick={() => document.getElementById('apply-form').scrollIntoView({ behavior: 'smooth' })}
          className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-400 transition-all duration-300 transform hover:scale-105 shadow-lg cursor-pointer"
        >
          Apply Now
        </button>
      </div>
    </div>
  );
}
