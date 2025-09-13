import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function ApplyForm() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const backend = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

  const [job, setJob] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [linkedin, setLinkedin] = React.useState('');
  const [resume, setResume] = React.useState(null); // { data, name }
  const [coverNote, setCoverNote] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${backend}/api/jobs/${jobId}`);
        const js = await resp.json();
        if (resp.ok) setJob(js.job || js);
      } catch {}
    })();
  }, [jobId]);

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) { setResume(null); setFileName(''); return; }
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      alert('Please upload a PDF or DOC/DOCX file.');
      e.target.value = '';
      return;
    }
    const b64 = await toBase64(file);
    setResume({ data: b64, name: file.name });
    setFileName(file.name);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email || !firstName || !lastName) return;
    setLoading(true);
    try {
      const name = `${firstName} ${lastName}`.trim();
      const payload = { name, email, phone, linkedin_url: linkedin, resume_file: resume, cover_note: coverNote };
      const resp = await fetch(`${backend}/api/jobs/${jobId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const js = await resp.json();
      if (resp.ok && js.success) {
        setSubmitted(true);
        setTimeout(() => navigate(`/apply/${jobId}/success`), 500);
      } else {
        alert(js.error || 'Submission failed');
      }
    } catch (err) {
      alert('Submission failed');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-brand-gray-50 min-h-screen flex items-center justify-center font-sans">
        <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-lg border border-brand-gray-200 text-center max-w-lg w-full">
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
            <i className="fa-solid fa-check text-4xl text-brand-secondary"></i>
          </div>
          <h2 className="text-3xl font-bold text-brand-gray-900">Application Received!</h2>
          <p className="mt-3 text-base text-brand-gray-500 max-w-md mx-auto">Thanks for applying. The recruiter will be in touch soon.</p>
          <div className="mt-8">
            <a href="/" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-brand-primary hover:bg-brand-primary-hover transition duration-150 ease-in-out">Return to Home</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-gray-50 antialiased font-sans min-h-screen">
      <div className="flex items-center justify-center w-full px-4 py-10">
        <section className="w-full max-w-3xl">
          <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-lg border border-brand-gray-200">
            <div className="text-center mb-10">
              <div className="flex justify-center items-center gap-3 mb-4">
                <div className="bg-brand-primary text-white w-10 h-10 flex items-center justify-center rounded-lg"><i className="fa-solid fa-bolt"></i></div>
                <h1 className="text-2xl font-bold text-brand-gray-900">HirePilot</h1>
              </div>
              <h2 className="text-3xl font-bold text-brand-gray-800">Apply for {job?.title || 'this role'}</h2>
              <p className="text-brand-gray-500 mt-2">{job?.location || ''}</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                <div>
                  <label className="block text-sm font-medium text-brand-gray-700 mb-1">First Name</label>
                  <input type="text" value={firstName} onChange={(e)=>setFirstName(e.target.value)} required className="block w-full px-4 py-3 border border-brand-gray-300 rounded-lg shadow-sm focus:ring-brand-primary focus:border-brand-primary" placeholder="Jane"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-gray-700 mb-1">Last Name</label>
                  <input type="text" value={lastName} onChange={(e)=>setLastName(e.target.value)} required className="block w-full px-4 py-3 border border-brand-gray-300 rounded-lg shadow-sm focus:ring-brand-primary focus:border-brand-primary" placeholder="Doe"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required className="block w-full px-4 py-3 border border-brand-gray-300 rounded-lg shadow-sm focus:ring-brand-primary focus:border-brand-primary" placeholder="jane.doe@example.com"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-gray-700 mb-1">Phone <span className="text-brand-gray-400">(Optional)</span></label>
                  <input type="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} className="block w-full px-4 py-3 border border-brand-gray-300 rounded-lg shadow-sm focus:ring-brand-primary focus:border-brand-primary" placeholder="+1 (555) 123-4567"/>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-brand-gray-700 mb-1">LinkedIn URL</label>
                  <input type="url" value={linkedin} onChange={(e)=>setLinkedin(e.target.value)} required className="block w-full px-4 py-3 border border-brand-gray-300 rounded-lg shadow-sm focus:ring-brand-primary focus:border-brand-primary" placeholder="https://linkedin.com/in/janedoe"/>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-gray-700 mb-1">Resume</label>
                <div className="mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-brand-gray-300 border-dashed rounded-lg">
                  <div className="space-y-1 text-center">
                    <i className="fa-solid fa-cloud-arrow-up mx-auto h-12 w-12 text-brand-gray-400"></i>
                    <div className="flex text-sm text-brand-gray-600">
                      <label htmlFor="resume-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-brand-primary hover:text-brand-primary-hover focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-primary">
                        <span>Upload a file</span>
                        <input id="resume-upload" name="resume-upload" type="file" className="sr-only" accept=".pdf,.doc,.docx" onChange={onFileChange} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-brand-gray-500">PDF, DOC, DOCX up to 10MB</p>
                    <p className="text-sm text-brand-gray-700 font-medium pt-2">{fileName}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-gray-700 mb-1">Cover Note</label>
                <textarea rows={6} value={coverNote} onChange={(e)=>setCoverNote(e.target.value)} className="block w-full px-4 py-3 border border-brand-gray-300 rounded-lg shadow-sm focus:ring-brand-primary focus:border-brand-primary" placeholder="Tell us why you're a great fit for this role..."></textarea>
              </div>

              <div className="pt-4">
                <button type="submit" disabled={loading} className="w-full flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-brand-primary hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary">
                  {loading ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}


