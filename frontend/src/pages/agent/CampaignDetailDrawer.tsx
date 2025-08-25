import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CampaignDetailPage from '../SuperAdmin/sourcing/CampaignDetailPage';

export default function CampaignDetailDrawer(){
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(()=>{
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') navigate('/agent'); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={()=>navigate('/agent')}></div>
      <div className="absolute top-0 right-0 h-full w-full max-w-4xl bg-gray-900 shadow-xl border-l border-slate-700 overflow-y-auto">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="text-white font-semibold">Campaign Details</div>
          <button onClick={()=>navigate('/agent')} className="text-gray-300 hover:text-white">Close</button>
        </div>
        <div className="p-4">
          <CampaignDetailPage />
        </div>
      </div>
    </div>
  );
}


