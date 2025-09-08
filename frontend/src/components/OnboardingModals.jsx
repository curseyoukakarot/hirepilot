import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function OnboardingModals() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        // Super admin should never see onboarding
        try {
          const { data: authUser } = await supabase.auth.getUser();
          const roleFromAuth = authUser?.user?.user_metadata?.role;
          const normalized = String(roleFromAuth || '').toLowerCase().replace(/\s|-/g, '_');
          if (['super_admin','superadmin'].includes(normalized)) { setVisible(false); return; }
        } catch {}
        const backend = import.meta.env.VITE_BACKEND_URL || '';
        const res = await fetch(`${backend}/api/user/settings`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
          credentials: 'include'
        });
        // Fetch onboarding flag from users table (filter by current user id)
        const { data: userData } = await supabase
          .from('users')
          .select('onboarding_complete')
          .eq('id', session.user.id)
          .maybeSingle();
        // Handle cases where no single row was returned
        const completed = userData?.onboarding_complete === true || false;
        if (!completed) setVisible(true);
      } catch {}
    })();
  }, []);

  const complete = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setVisible(false);
      const backend = import.meta.env.VITE_BACKEND_URL || '';
      await fetch(`${backend}/api/user/onboarding-complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  const cards = [
    {
      title: 'Meet REX',
      body: 'Your AI recruiting assistant for sourcing and messaging.',
      cta: { label: 'Open REX', href: '/rex' }
    },
    {
      title: 'Install Chrome Extension',
      body: 'Scrape LinkedIn/Sales Navigator and send messages instantly.',
      cta: { label: 'Install', href: '/chromeextension' }
    },
    {
      title: 'Create your first job/campaign',
      body: 'Start a campaign to reach candidates with personalized messages.',
      cta: { label: 'Create Campaign', href: '/campaigns/new/job-description' }
    }
  ];

  const curr = cards[step] || cards[0];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-2xl font-bold mb-2">{curr.title}</h3>
        <p className="text-gray-600 mb-6">{curr.body}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {cards.map((_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i === step ? 'bg-blue-600' : 'bg-gray-300'}`}></span>
            ))}
          </div>
          <div className="flex gap-3">
            <a href={curr.cta.href} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">{curr.cta.label}</a>
            {step < cards.length - 1 ? (
              <button className="px-3 py-2 text-gray-700" onClick={() => setStep(step + 1)}>Next</button>
            ) : (
              <button className="px-3 py-2 text-gray-700" onClick={complete}>Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


