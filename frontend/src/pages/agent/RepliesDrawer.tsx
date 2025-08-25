import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RepliesPage from '../SuperAdmin/sourcing/RepliesPage';

export default function RepliesDrawer(){
  const navigate = useNavigate();
  useEffect(()=>{
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') navigate(-1); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/50" onClick={()=>navigate(-1)}></div>
      <div className="absolute top-0 right-0 h-full w-full max-w-3xl bg-gray-900 shadow-xl border-l border-slate-700 overflow-y-auto">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="text-white font-semibold">Campaign Replies</div>
          <button onClick={()=>navigate(-1)} className="text-gray-300 hover:text-white">Close</button>
        </div>
        <div className="p-4">
          <RepliesPage />
        </div>
      </div>
    </div>
  );
}


