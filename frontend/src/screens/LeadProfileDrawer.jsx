import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { FaWandMagicSparkles } from 'react-icons/fa6';
import { supabase } from '../lib/supabase';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

// You may want to use react-icons for FontAwesome icons, or keep <i> tags if you have FontAwesome loaded globally

export default function LeadProfileDrawer({ lead, onClose, isOpen, onLeadUpdated }) {
  const navigate = useNavigate();
  const [isConverting, setIsConverting] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState({ apollo: null, gpt: null });
  const [localLead, setLocalLead] = useState(lead);
  
  // Edit states for contact fields
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingTwitter, setEditingTwitter] = useState(false);
  const [tempEmail, setTempEmail] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [tempTwitter, setTempTwitter] = useState('');

  useEffect(() => {
    // Parse enrichment_data if it's a string
    let parsed = lead;
    if (lead && typeof lead.enrichment_data === 'string') {
      try {
        parsed = { ...lead, enrichment_data: JSON.parse(lead.enrichment_data) };
      } catch (e) {
        parsed = { ...lead, enrichment_data: {} };
      }
    }
    setLocalLead(parsed);

    // When drawer opens, pull the freshest lead data from backend
    if (isOpen && lead?.id) {
      fetchLatestLead(lead.id);
    }
  }, [lead, isOpen]);

  // Toast helper (replace with your own toast if needed)
  const showToast = (msg, type = 'success') => {
    window.alert(msg); // Replace with your toast system
  };

  // Contact field editing functions
  const startEditingEmail = () => {
    const currentEmail = localLead.email || 
      (localLead.enrichment_data?.apollo?.email && 
       !localLead.enrichment_data.apollo.email.includes('email_not_unlocked') ? 
       localLead.enrichment_data.apollo.email : '') ||
      (localLead.enrichment_data?.apollo?.personal_emails?.[0]?.email) || '';
    setTempEmail(currentEmail);
    setEditingEmail(true);
  };

  const startEditingPhone = () => {
    const currentPhone = localLead.phone || 
      (localLead.enrichment_data?.apollo?.phone) ||
      (localLead.enrichment_data?.apollo?.personal_numbers?.[0]?.number) || '';
    setTempPhone(currentPhone);
    setEditingPhone(true);
  };

  const startEditingTwitter = () => {
    setTempTwitter(localLead.twitter || '');
    setEditingTwitter(true);
  };

  const saveContactField = async (field, value) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(`${API_BASE_URL}/leads/${localLead.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) throw new Error('Failed to update lead');
      
      const updatedLead = await response.json();
      setLocalLead({ ...localLead, [field]: value });
      onLeadUpdated?.({ ...localLead, [field]: value });
      showToast(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`);
    } catch (error) {
      showToast(`Failed to update ${field}: ${error.message}`, 'error');
    }
  };

  const cancelEditing = (field) => {
    if (field === 'email') {
      setEditingEmail(false);
      setTempEmail('');
    } else if (field === 'phone') {
      setEditingPhone(false);
      setTempPhone('');
    } else if (field === 'twitter') {
      setEditingTwitter(false);
      setTempTwitter('');
    }
  };

  const handleConvertToCandidate = async () => {
    if (!localLead?.id) return;
    setIsConverting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const accessToken = session.access_token;
      const response = await fetch(`${API_BASE_URL}/leads/${localLead.id}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: session.user.id }),
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to convert lead' }));
        throw new Error(errorData.message || 'Failed to convert lead');
      }
      showToast('Lead converted to candidate successfully!', 'success');
      onClose();
      // Optionally, navigate to candidates page:
      // navigate('/candidates');
    } catch (error) {
      showToast(error.message || 'Failed to convert lead', 'error');
    } finally {
      setIsConverting(false);
    }
  };

  // Helper to get display name
  const getDisplayName = (lead) => {
    if (lead.first_name && lead.last_name) return `${lead.first_name} ${lead.last_name}`;
    if (lead.first_name) return lead.first_name;
    if (lead.name) return lead.name;
    return '';
  };

  // Helper to get LinkedIn URL
  const getLinkedInUrl = (lead) => lead.linkedin_url || lead.linkedin || '';

  // Helper to get work history from Apollo data
  const getWorkHistory = (lead) => {
    if (
      lead.enrichment_data?.apollo?.experiences &&
      Array.isArray(lead.enrichment_data.apollo.experiences) &&
      lead.enrichment_data.apollo.experiences.length > 0
    ) {
      // Map Apollo experiences to a common format
      return lead.enrichment_data.apollo.experiences.map(exp => ({
        company: exp.company || exp.organization_name,
        title: exp.title,
        years: (exp.start_date ? exp.start_date : '') +
               (exp.end_date ? ` - ${exp.end_date}` : exp.current ? ' - Present' : ''),
        description: exp.description || '',
        location: exp.location || ''
      }));
    }
    // Fallback to mock or other data
    if (lead.workHistory && lead.workHistory.length > 0) return lead.workHistory;
    if (lead.enrichment_data && Array.isArray(lead.enrichment_data.workHistory) && lead.enrichment_data.workHistory.length > 0) return lead.enrichment_data.workHistory;
    return [];
  };

  // Helper to get GPT notes (from Apollo or GPT analysis)
  const getGptNotes = (lead) => {
    if (lead.enrichment_data?.apollo?.summary) return lead.enrichment_data.apollo.summary;
    if (lead.enrichment_data?.gpt?.analysis) return lead.enrichment_data.gpt.analysis;
    if (lead.gptNotes) return lead.gptNotes;
    if (lead.enrichment_data && lead.enrichment_data.gptNotes) return lead.enrichment_data.gptNotes;
    return '';
  };

  // Helper to get skills (from Apollo data)
  const getSkills = (lead) => {
    if (
      lead.enrichment_data?.apollo?.skills &&
      Array.isArray(lead.enrichment_data.apollo.skills) &&
      lead.enrichment_data.apollo.skills.length > 0
    ) return lead.enrichment_data.apollo.skills;
    if (lead.skills && lead.skills.length > 0) return lead.skills;
    if (lead.enrichment_data && Array.isArray(lead.enrichment_data.skills) && lead.enrichment_data.skills.length > 0) return lead.enrichment_data.skills;
    return [];
  };

  // Helper to determine if lead is enriched – any non-empty enrichment_data counts
  const isEnriched = Boolean(
    localLead.enrichment_data && Object.keys(localLead.enrichment_data).length > 0
  );

  // Add a function to fetch the latest lead data
  const fetchLatestLead = async (id) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const accessToken = session.access_token;
      const response = await fetch(`${API_BASE_URL}/leads/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
      if (!response.ok) return;
      const latest = await response.json();
      // Parse enrichment_data if it's a string
      let parsed = latest;
      if (latest && typeof latest.enrichment_data === 'string') {
        try {
          parsed = { ...latest, enrichment_data: JSON.parse(latest.enrichment_data) };
        } catch (e) {
          parsed = { ...latest, enrichment_data: {} };
        }
      }
      setLocalLead(parsed);
      onLeadUpdated?.(parsed);
    } catch (e) {
      // ignore
    }
  };

  const handleEnrich = async () => {
    if (!localLead?.id) return;
    setIsEnriching(true);
    setEnrichStatus({ apollo: null, gpt: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const accessToken = session.access_token;
      const response = await fetch(`${API_BASE_URL}/leads/${localLead.id}/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to enrich lead' }));
        
        // Check for specific error types
        if (response.status === 404) {
          setEnrichStatus({ 
            apollo: 'no_results', 
            gpt: 'no_results',
            apolloMsg: 'Nothing was found',
            gptMsg: 'No profile data available'
          });
          showToast('Nothing was found for this lead. You can manually add contact information using the edit buttons above.', 'info');
          return;
        } else if (response.status >= 500) {
          setEnrichStatus({ 
            apollo: 'retry', 
            gpt: 'retry',
            apolloMsg: 'Service temporarily unavailable',
            gptMsg: 'Service temporarily unavailable'
          });
          showToast('Service temporarily unavailable. Please try again in a moment.', 'warning');
          return;
        } else {
          throw new Error(errorData.message || 'Failed to enrich lead');
        }
      }
      
      const updated = await response.json();
      let enrichmentData = updated.enrichment_data;
      if (typeof enrichmentData === 'string') {
        try {
          enrichmentData = JSON.parse(enrichmentData);
        } catch (e) {
          enrichmentData = {};
        }
      }
      
      const newLead = {
        ...localLead,
        ...updated,
        workHistory: updated.workHistory || (enrichmentData && enrichmentData.workHistory) || localLead.workHistory,
        gptNotes: updated.gptNotes || (enrichmentData && enrichmentData.gptNotes) || localLead.gptNotes,
        enrichment_data: enrichmentData || localLead.enrichment_data
      };
      
      // Parse enrichment_data if it's a string (defensive)
      let parsed = newLead;
      if (newLead && typeof newLead.enrichment_data === 'string') {
        try {
          parsed = { ...newLead, enrichment_data: JSON.parse(newLead.enrichment_data) };
        } catch (e) {
          parsed = { ...newLead, enrichment_data: {} };
        }
      }
      
      setLocalLead(parsed);
      onLeadUpdated?.(parsed);
      // Fetch the latest lead from backend to ensure UI is up to date
      fetchLatestLead(localLead.id);
      
      // Check if any data was actually found
      const hasNewEmail = parsed.email && parsed.email !== localLead.email;
      const hasNewPhone = parsed.phone && parsed.phone !== localLead.phone;
      const hasEnrichmentData = enrichmentData && Object.keys(enrichmentData).length > 0;
      
      if (!hasNewEmail && !hasNewPhone && !hasEnrichmentData) {
        setEnrichStatus({ 
          apollo: 'no_results', 
          gpt: 'no_results',
          apolloMsg: 'Nothing was found',
          gptMsg: 'No additional data found'
        });
        showToast('Nothing was found for this lead. You can manually add contact information using the edit buttons above.', 'info');
      } else {
        // Set enrichment status for visual feedback
        setEnrichStatus({
          apollo: updated.apolloErrorMsg ? (updated.apolloErrorMsg.includes('not found') ? 'no_results' : 'retry') : 'success',
          gpt: updated.gptErrorMsg ? (updated.gptErrorMsg.includes('not found') ? 'no_results' : 'retry') : 'success',
          apolloMsg: updated.apolloErrorMsg,
          gptMsg: updated.gptErrorMsg
        });
        
        if (updated.apolloErrorMsg && !updated.gptErrorMsg) {
          if (updated.apolloErrorMsg.includes('not found')) {
            showToast('Apollo found nothing, but other data was enriched successfully.', 'info');
          } else {
            showToast('Apollo enrichment failed, but other data was enriched successfully. You can try again.', 'warning');
          }
        } else if (!updated.apolloErrorMsg && updated.gptErrorMsg) {
          if (updated.gptErrorMsg.includes('not found')) {
            showToast('Profile analysis found nothing, but contact data was enriched successfully.', 'info');
          } else {
            showToast('Profile analysis failed, but contact data was enriched successfully. You can try again.', 'warning');
          }
        } else if (updated.apolloErrorMsg && updated.gptErrorMsg) {
          const hasRetryableErrors = !updated.apolloErrorMsg.includes('not found') || !updated.gptErrorMsg.includes('not found');
          if (hasRetryableErrors) {
            showToast('Enrichment failed. Please try again.', 'warning');
          } else {
            showToast('Nothing was found for this lead. You can manually add contact information.', 'info');
          }
        } else {
          const foundItems = [];
          if (hasNewEmail) foundItems.push('email');
          if (hasNewPhone) foundItems.push('phone');
          if (hasEnrichmentData) foundItems.push('profile data');
          
          showToast(`Lead enriched successfully! Found: ${foundItems.join(', ')}.`, 'success');
        }
      }
    } catch (error) {
      setEnrichStatus({ 
        apollo: 'retry', 
        gpt: 'retry',
        apolloMsg: 'Connection failed',
        gptMsg: 'Connection failed'
      });
      showToast(`Connection failed. Please try again. ${error.message}`, 'error');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleMessageAgain = () => {
    if (!localLead) return;
    // Save lead info to localStorage for Messaging Center to pick up
    localStorage.setItem('selectedLead', JSON.stringify({
      id: localLead.id,
      name: localLead.name,
      email: localLead.email,
      company: localLead.company,
      title: localLead.title
    }));
    navigate('/messages');
  };

  if (!isOpen || !localLead) return null;

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? '' : 'pointer-events-none'}`}>
      {/* Overlay - click to close */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div className="absolute inset-0 overflow-hidden">
        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className={`pointer-events-auto w-[768px] h-full transition-transform duration-300 transform bg-white shadow-xl flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Loading Overlay for Enrichment */}
            {isEnriching && (
              <div className="absolute inset-0 bg-white bg-opacity-80 z-50 flex flex-col items-center justify-center">
                <svg className="animate-spin h-10 w-10 text-purple-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                <span className="text-lg text-purple-700 font-semibold">Enriching profile...</span>
              </div>
            )}
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <img src={localLead.avatar || "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"} alt="Profile Picture" className="w-12 h-12 rounded-full" />
                <div>
                  <h2 className="text-xl font-semibold">{getDisplayName(localLead) || "Name"}</h2>
                  <p className="text-gray-600">{localLead.title || "Title"}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button className="text-gray-400 hover:text-gray-500">
                  <i className="fa-solid fa-pen-to-square text-lg"></i>
                </button>
                {/* Close Drawer Button */}
                <button className="text-gray-400 hover:text-gray-500 text-2xl ml-2" onClick={onClose} aria-label="Close drawer">
                  <FiX />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Quick Actions */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex space-x-4">
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center"
                    onClick={handleMessageAgain}
                  >
                    <i className="fa-regular fa-paper-plane mr-2"></i>
                    Message
                  </button>
                  <button
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center"
                    onClick={handleConvertToCandidate}
                    disabled={isConverting}
                  >
                    <i className="fa-solid fa-user-plus mr-2"></i>
                    {isConverting ? 'Converting...' : 'Convert to Candidate'}
                  </button>
                  <button
                    className="px-4 py-2 bg-purple-50 border border-purple-500 text-purple-700 rounded-lg flex items-center hover:bg-purple-100 disabled:opacity-50"
                    onClick={handleEnrich}
                    disabled={isEnriching}
                  >
                    {isEnriching ? (
                      <svg className="animate-spin h-4 w-4 mr-1 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                      </svg>
                    ) : (
                      <FaWandMagicSparkles className="mr-1" />
                    )}
                    Enrich
                  </button>
                </div>
                {/* Enrichment Status Feedback */}
                {(enrichStatus.apollo || enrichStatus.gpt) && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        enrichStatus.apollo === 'success' ? 'bg-green-100 text-green-800' : 
                        enrichStatus.apollo === 'no_results' ? 'bg-yellow-100 text-yellow-800' :
                        enrichStatus.apollo === 'retry' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Apollo: {
                          enrichStatus.apollo === 'success' ? 'Success' : 
                          enrichStatus.apollo === 'no_results' ? 'Nothing found' :
                          enrichStatus.apollo === 'retry' ? 'Can retry' :
                          'Failed'
                        }
                      </span>
                      {enrichStatus.apollo === 'retry' && (
                        <button
                          onClick={handleEnrich}
                          disabled={isEnriching}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                          Try Again
                        </button>
                      )}
                      {(enrichStatus.apollo === 'error' || enrichStatus.apollo === 'no_results' || enrichStatus.apollo === 'retry') && enrichStatus.apolloMsg && (
                        <span className="text-xs text-gray-600">{enrichStatus.apolloMsg}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        enrichStatus.gpt === 'success' ? 'bg-green-100 text-green-800' : 
                        enrichStatus.gpt === 'no_results' ? 'bg-yellow-100 text-yellow-800' :
                        enrichStatus.gpt === 'retry' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Profile Analysis: {
                          enrichStatus.gpt === 'success' ? 'Success' : 
                          enrichStatus.gpt === 'no_results' ? 'Nothing found' :
                          enrichStatus.gpt === 'retry' ? 'Can retry' :
                          'Failed'
                        }
                      </span>
                      {enrichStatus.gpt === 'retry' && (
                        <button
                          onClick={handleEnrich}
                          disabled={isEnriching}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                          Try Again
                        </button>
                      )}
                      {(enrichStatus.gpt === 'error' || enrichStatus.gpt === 'no_results' || enrichStatus.gpt === 'retry') && enrichStatus.gptMsg && (
                        <span className="text-xs text-gray-600">{enrichStatus.gptMsg}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Sections */}
              <div className="px-6 py-6 space-y-8">
                {/* Always show: LinkedIn, Contact Info, Name, Profile Pic */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">LinkedIn Profile</h3>
                  <div className="flex items-center space-x-3 text-blue-600">
                    <i className="fa-brands fa-linkedin text-xl"></i>
                    {getLinkedInUrl(localLead) ? (
                      <a href={getLinkedInUrl(localLead)} target="_blank" rel="noopener noreferrer" className="hover:underline cursor-pointer">
                        {getLinkedInUrl(localLead).replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Contact Information</h3>
                  <div className="space-y-3">
                    {/* Email Field */}
                    <div className="flex items-center space-x-3">
                      <i className="fa-regular fa-envelope text-gray-500"></i>
                      {editingEmail ? (
                        <div className="flex items-center space-x-2 flex-1">
                          <input
                            type="email"
                            value={tempEmail}
                            onChange={(e) => setTempEmail(e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter email"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              saveContactField('email', tempEmail);
                              setEditingEmail(false);
                            }}
                            className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                          >
                            <i className="fa-solid fa-check"></i>
                          </button>
                          <button
                            onClick={() => cancelEditing('email')}
                            className="px-2 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                          >
                            <i className="fa-solid fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 flex-1">
                          <span className="flex-1">{
                            localLead.email || 
                            (localLead.enrichment_data?.apollo?.email && 
                             !localLead.enrichment_data.apollo.email.includes('email_not_unlocked') ? 
                             localLead.enrichment_data.apollo.email : null) ||
                            (localLead.enrichment_data?.apollo?.personal_emails?.[0]?.email) ||
                            "N/A"
                          }</span>
                          <button
                            onClick={startEditingEmail}
                            className="px-2 py-1 text-gray-500 hover:text-blue-600 text-sm"
                            title="Edit email"
                          >
                            <i className="fa-solid fa-pencil"></i>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Phone Field */}
                    <div className="flex items-center space-x-3">
                      <i className="fa-solid fa-phone text-gray-500"></i>
                      {editingPhone ? (
                        <div className="flex items-center space-x-2 flex-1">
                          <input
                            type="tel"
                            value={tempPhone}
                            onChange={(e) => setTempPhone(e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter phone number"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              saveContactField('phone', tempPhone);
                              setEditingPhone(false);
                            }}
                            className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                          >
                            <i className="fa-solid fa-check"></i>
                          </button>
                          <button
                            onClick={() => cancelEditing('phone')}
                            className="px-2 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                          >
                            <i className="fa-solid fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 flex-1">
                          <span className="flex-1">{
                            localLead.phone || 
                            (localLead.enrichment_data?.apollo?.phone) ||
                            (localLead.enrichment_data?.apollo?.personal_numbers?.[0]?.number) ||
                            "N/A"
                          }</span>
                          <button
                            onClick={startEditingPhone}
                            className="px-2 py-1 text-gray-500 hover:text-blue-600 text-sm"
                            title="Edit phone"
                          >
                            <i className="fa-solid fa-pencil"></i>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Twitter/X Field */}
                    <div className="flex items-center space-x-3">
                      <i className="fa-brands fa-x-twitter text-gray-500"></i>
                      {editingTwitter ? (
                        <div className="flex items-center space-x-2 flex-1">
                          <input
                            type="text"
                            value={tempTwitter}
                            onChange={(e) => setTempTwitter(e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter X/Twitter handle"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              saveContactField('twitter', tempTwitter);
                              setEditingTwitter(false);
                            }}
                            className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                          >
                            <i className="fa-solid fa-check"></i>
                          </button>
                          <button
                            onClick={() => cancelEditing('twitter')}
                            className="px-2 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                          >
                            <i className="fa-solid fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 flex-1">
                          <span className="flex-1">{localLead.twitter || "N/A"}</span>
                          <button
                            onClick={startEditingTwitter}
                            className="px-2 py-1 text-gray-500 hover:text-blue-600 text-sm"
                            title="Edit X/Twitter"
                          >
                            <i className="fa-solid fa-pencil"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Blur the rest if not enriched */}
                <div className={isEnriched ? '' : 'relative pointer-events-none select-none'}>
                  <div className={isEnriched ? '' : 'blur-sm'}>
                    {/* Work History */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Work History</h3>
                      <div className="space-y-4">
                        {isEnriched ? (
                          getWorkHistory(localLead).length > 0 ? getWorkHistory(localLead).map((job, idx) => (
                            <div className="flex space-x-4" key={idx}>
                              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <i className="fa-solid fa-building text-gray-500"></i>
                              </div>
                              <div>
                                <h4 className="font-medium">{job.company}</h4>
                                <p className="text-gray-600">{job.title}</p>
                                <p className="text-sm text-gray-500">{job.years}</p>
                                {job.description && <p className="text-xs text-gray-400">{job.description}</p>}
                              </div>
                            </div>
                          )) : <span className="text-gray-400">No work history found.</span>
                        ) : (
                          [
                            { company: "Google", title: "Senior Software Engineer", years: "2022 - Present" },
                            { company: "Microsoft", title: "Software Engineer", years: "2019 - 2022" },
                          ].map((job, idx) => (
                            <div className="flex space-x-4" key={idx}>
                              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <i className="fa-solid fa-building text-gray-500"></i>
                              </div>
                              <div>
                                <h4 className="font-medium">{job.company}</h4>
                                <p className="text-gray-600">{job.title}</p>
                                <p className="text-sm text-gray-500">{job.years}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    {/* Skills */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Skills & Keywords</h3>
                      <div className="flex flex-wrap gap-2">
                        {isEnriched ? (
                          getSkills(localLead).length > 0 ? getSkills(localLead).map((skill, idx) => (
                            <span key={idx} className="px-3 py-1 bg-gray-100 rounded-full text-sm">{skill}</span>
                          )) : <span className="text-gray-400">No skills found.</span>
                        ) : (
                          ["React", "Node.js", "TypeScript", "AWS", "System Design"].map((skill, idx) => (
                            <span key={idx} className="px-3 py-1 bg-gray-100 rounded-full text-sm">{skill}</span>
                          ))
                        )}
                      </div>
                    </div>
                    {/* GPT Notes */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">GPT-Generated Notes</h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        {isEnriched ? (
                          getGptNotes(localLead) ? <p className="text-gray-600">{getGptNotes(localLead)}</p> : <span className="text-gray-400">No notes found.</span>
                        ) : (
                          <p className="text-gray-600">Strong technical background with 6+ years of experience in full-stack development. Currently leading a team at Google, showing both technical expertise and leadership capabilities. Active in the open-source community and regular speaker at tech conferences.</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Overlay message if not enriched */}
                  {!isEnriched && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 z-10">
                      <span className="text-lg font-semibold text-gray-700 mb-2">Enrich to unlock full profile</span>
                      <FaWandMagicSparkles className="text-purple-500 text-2xl" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


