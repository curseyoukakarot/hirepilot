import React from 'react';
import { useParams, Link } from 'react-router-dom';

export default function ApplySuccess() {
  const { jobId } = useParams();
  return (
    <div className="bg-brand-gray-50 min-h-screen flex items-center justify-center font-sans">
      <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-lg border border-brand-gray-200 text-center max-w-lg w-full">
        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
          <i className="fa-solid fa-check text-4xl text-brand-secondary"></i>
        </div>
        <h2 className="text-3xl font-bold text-brand-gray-900">Application Received!</h2>
        <p className="mt-3 text-base text-brand-gray-500 max-w-md mx-auto">
          Thanks for applying. The recruiter will be in touch.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-brand-primary hover:bg-brand-primary-hover transition duration-150 ease-in-out">
            Return to Home
          </Link>
          <Link to={`/jobs/share/${jobId}`} className="hidden md:inline-flex items-center justify-center px-6 py-3 border border-brand-gray-300 text-base font-medium rounded-lg text-brand-gray-700 bg-white hover:bg-brand-gray-100 transition duration-150 ease-in-out">
            View Job Again
          </Link>
        </div>
      </div>
    </div>
  );
}


