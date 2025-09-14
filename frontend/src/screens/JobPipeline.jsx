import React from 'react';
import { useParams } from 'react-router-dom';
import PipelineBoard from '../components/pipeline/PipelineBoard';

export default function JobPipeline({ embedded = false, jobId: jobIdProp = null }) {
  const { id: jobIdParam } = useParams();
  const jobId = jobIdProp || jobIdParam || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex-1 overflow-hidden">
        <PipelineBoard jobId={jobId} />
      </div>
    </div>
  );
}


