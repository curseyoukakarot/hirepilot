import React, { useEffect, useMemo, useState } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';

export default function InviteTeamMemberModal({ isOpen, onClose, onInviteSuccess, requireCheckout }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    role: 'member'
  });
  const [permissions, setPermissions] = useState({
    rexAccess: true,
    zapierAccess: false,
    allocatedCredits: 0,
  });
  const [availableCredits, setAvailableCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const stripePromise = useMemo(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    return key ? loadStripe(key) : null;
  }, []);

  const resetForm = () => {
    setStep(1);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      company: '',
      role: 'member'
    });
    setPermissions({ rexAccess: true, zapierAccess: false, allocatedCredits: 0 });
    setAvailableCredits(0);
    setError(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        // Pull current credit status for allocation pool
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/credits/status`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableCredits(data.remaining_credits ?? 0);
        }
      } catch (e) {
        // Non-fatal
      }
    })();
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const submitInvite = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be logged in to invite team members');

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/team/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          permissions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to send invitation (${response.status})`);
      }

      // Success
      setStep(4);
      toast.success(`Invitation sent to ${formData.email}`);
      if (onInviteSuccess) onInviteSuccess();
    } catch (err) {
      console.error('Error sending invitation:', err);
      setError(err.message || 'Failed to send invitation.');
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckout = async (interval) => {
    try {
      setCheckoutLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      // Use backend billing checkout with planId=pro for seats
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ planId: 'pro', interval })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create checkout session');
      }
      const { sessionId } = await res.json();
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe not initialized');
      await stripe.redirectToCheckout({ sessionId });
    } catch (e) {
      toast.error(e.message || 'Checkout failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Invite Team Member</h2>
          <button onClick={() => { resetForm(); onClose(); }} className="text-gray-400 hover:text-gray-600" disabled={isLoading}>
            <FaXmark />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}

        {/* Step indicators */}
        <div className="flex items-center mb-4">
          {[1,2,3,4].map((s) => (
            <div key={s} className={`flex-1 h-1 mx-1 rounded ${step >= s ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name*</label>
                <input name="firstName" value={formData.firstName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name*</label>
                <input name="lastName" value={formData.lastName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email*</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500" placeholder="john@company.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input name="company" value={formData.company} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500" placeholder="Acme Inc." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role*</label>
              <select name="role" value={formData.role} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500">
                <option value="admin">Admin</option>
                <option value="team_admin">Team Admin</option>
                <option value="member">Member</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="border border-gray-300 hover:bg-gray-50 rounded-xl px-5 py-2 text-gray-700" onClick={() => { resetForm(); onClose(); }} disabled={isLoading}>Cancel</button>
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2" onClick={() => setStep(2)}>Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">REX Access</span>
              <input type="checkbox" className="h-5 w-5" checked={permissions.rexAccess} onChange={(e) => setPermissions(p => ({ ...p, rexAccess: e.target.checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Zapier/Make Access</span>
              <input type="checkbox" className="h-5 w-5" checked={permissions.zapierAccess} onChange={(e) => setPermissions(p => ({ ...p, zapierAccess: e.target.checked }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allocate Credits</label>
              <div className="flex items-center gap-3">
                <input type="number" min={0} max={availableCredits} value={permissions.allocatedCredits} onChange={(e) => setPermissions(p => ({ ...p, allocatedCredits: Math.max(0, Math.min(availableCredits, Number(e.target.value)||0)) }))} className="w-32 px-3 py-2 border rounded-lg focus:ring-indigo-500" />
                <span className="text-xs text-gray-500">Available: {availableCredits}</span>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <button className="border border-gray-300 hover:bg-gray-50 rounded-xl px-5 py-2 text-gray-700" onClick={() => setStep(1)}>Back</button>
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2" onClick={() => (requireCheckout ? setStep(3) : submitInvite())} disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-base text-gray-700 leading-relaxed">
              No available seats detected. Choose a plan to add a seat for this member.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button disabled={checkoutLoading} onClick={() => handleCheckout('monthly')} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-3">$99 / month</button>
              <button disabled={checkoutLoading} onClick={() => handleCheckout('annual')} className="border border-gray-300 hover:bg-gray-50 rounded-xl px-5 py-3 text-gray-700">$69 / month (annual)</button>
            </div>
            <div className="flex justify-between pt-2">
              <button className="border border-gray-300 hover:bg-gray-50 rounded-xl px-5 py-2 text-gray-700" onClick={() => setStep(2)}>Back</button>
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2" onClick={submitInvite} disabled={isLoading}>{isLoading ? 'Sending...' : 'Send Invite'}</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">✅</div>
            <div className="text-xl font-semibold text-gray-900 mb-1">Invitation Sent</div>
            <div className="text-gray-600 mb-6">We emailed {formData.email}. You can invite more teammates.</div>
            <div className="flex justify-center gap-3">
              <button className="border border-gray-300 hover:bg-gray-50 rounded-xl px-5 py-2 text-gray-700" onClick={() => { resetForm(); onClose(); }}>Close</button>
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2" onClick={() => { setStep(1); setFormData(f => ({...f, email: ''})); }}>Invite More</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 