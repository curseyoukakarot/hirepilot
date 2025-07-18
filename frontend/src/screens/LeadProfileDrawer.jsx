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
  
  // LinkedIn request modal state
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [linkedInMessage, setLinkedInMessage] = useState('');
  const [isSubmittingLinkedIn, setIsSubmittingLinkedIn] = useState(false);
  const [dailyLinkedInCount, setDailyLinkedInCount] = useState(0);
  const [isLoadingLinkedInCount, setIsLoadingLinkedInCount] = useState(false);
  const [userCredits, setUserCredits] = useState(0);

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
      fetchDailyLinkedInCount();
      fetchUserCredits();
    }
  }, [lead, isOpen]);

  // Toast helper (replace with your own toast if needed)
  const showToast = (msg, type = 'success') => {
    window.alert(msg); // Replace with your toast system
  };

  // Fetch daily LinkedIn request count
  const fetchDailyLinkedInCount = async () => {
    if (!isOpen) return;
    
    setIsLoadingLinkedInCount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE_URL}/linkedin/daily-count`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDailyLinkedInCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch daily LinkedIn count:', error);
    } finally {
      setIsLoadingLinkedInCount(false);
    }
  };

  // Fetch user credits
  const fetchUserCredits = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE_URL}/user/credits`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserCredits(data.credits || 0);
      } else {
        console.error('Failed to fetch user credits:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch user credits:', error);
    }
  };

  // Contact field editing functions
  const startEditingEmail = () => {
    const emailInfo = getEmailWithSource(localLead);
    const currentEmail = emailInfo ? emailInfo.email : '';
    setTempEmail(currentEmail);
    setEditingEmail(true);
  };

  const startEditingPhone = () => {
    const phoneInfo = getPhoneWithSource(localLead);
    const currentPhone = phoneInfo ? phoneInfo.phone : '';
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

  // Helper to generate avatar URL with initials (like in leads page)
  const getAvatarUrl = (lead) => {
    const name = getDisplayName(lead);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
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

  // NEW: Helper to detect enrichment sources and get metadata
  const getEnrichmentSources = (lead) => {
    const sources = [];
    const enrichmentData = lead.enrichment_data || {};

    // Check for Hunter.io enrichment
    if (enrichmentData.hunter?.email) {
      sources.push({
        type: 'hunter',
        name: 'Hunter.io',
        data: enrichmentData.hunter,
        badge: 'Email via Hunter.io',
        color: 'bg-green-100 text-green-800',
        icon: '🎯'
      });
    }

    // Check for Skrapp.io enrichment
    if (enrichmentData.skrapp?.email) {
      sources.push({
        type: 'skrapp',
        name: 'Skrapp.io',
        data: enrichmentData.skrapp,
        badge: 'Email via Skrapp.io',
        color: 'bg-blue-100 text-blue-800',
        icon: '🔍'
      });
    }

    // Check for Apollo enrichment
    if (enrichmentData.apollo) {
      sources.push({
        type: 'apollo',
        name: 'Apollo',
        data: enrichmentData.apollo,
        badge: enrichmentData.apollo.used_as_fallback ? 'Profile via Apollo (fallback)' : 'Enriched via Apollo',
        color: 'bg-purple-100 text-purple-800',
        icon: '🚀'
      });
    }

    // Check for PhantomBuster (Sales Navigator) enrichment
    if (enrichmentData.phantombuster || enrichmentData.sales_navigator) {
      sources.push({
        type: 'phantombuster',
        name: 'PhantomBuster',
        data: enrichmentData.phantombuster || enrichmentData.sales_navigator,
        badge: 'Enriched via PhantomBuster',
        color: 'bg-indigo-100 text-indigo-800',
        icon: '👻'
      });
    }

    return sources;
  };

  // Helper to get the primary email source with tooltip info
  const getEmailWithSource = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    
    // Check if email came from Hunter.io
    if (enrichmentData.hunter?.email) {
      return {
        email: enrichmentData.hunter.email,
        source: 'Hunter.io',
        tooltip: `Email found via Hunter.io with confidence score`,
        enrichedAt: enrichmentData.hunter.enriched_at
      };
    }

    // Check if email came from Skrapp.io
    if (enrichmentData.skrapp?.email) {
      return {
        email: enrichmentData.skrapp.email,
        source: 'Skrapp.io',
        tooltip: `Email found via Skrapp.io with high confidence`,
        enrichedAt: enrichmentData.skrapp.enriched_at
      };
    }

    // Check if email came from Apollo
    if (enrichmentData.apollo?.email && !enrichmentData.apollo.email.includes('email_not_unlocked')) {
      return {
        email: enrichmentData.apollo.email,
        source: 'Apollo',
        tooltip: `Email found via Apollo enrichment`,
        enrichedAt: enrichmentData.apollo.enriched_at
      };
    }

    // Fallback to lead's direct email field
    if (lead.email) {
      return {
        email: lead.email,
        source: 'Direct',
        tooltip: `Email added directly`,
        enrichedAt: null
      };
    }

    return null;
  };

  // Helper to get the primary phone source with tooltip info
  const getPhoneWithSource = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    
    // Check if phone came from Apollo
    if (enrichmentData.apollo?.phone) {
      return {
        phone: enrichmentData.apollo.phone,
        source: 'Apollo',
        tooltip: `Phone found via Apollo enrichment`,
        enrichedAt: enrichmentData.apollo.enriched_at
      };
    }

    // Check Apollo personal numbers
    if (enrichmentData.apollo?.personal_numbers?.[0]?.number) {
      return {
        phone: enrichmentData.apollo.personal_numbers[0].number,
        source: 'Apollo',
        tooltip: `Personal phone found via Apollo enrichment`,
        enrichedAt: enrichmentData.apollo.enriched_at
      };
    }

    // Fallback to lead's direct phone field
    if (lead.phone) {
      return {
        phone: lead.phone,
        source: 'Direct',
        tooltip: `Phone added directly`,
        enrichedAt: null
      };
    }

    return null;
  };

  // Helper to determine lead source for appropriate messaging
  const getLeadSource = (lead) => {
    // You might want to add a 'source' field to leads table to track this
    // For now, infer from available data
    if (lead.lead_source) return lead.lead_source;
    if (lead.linkedin_url && lead.linkedin_url.includes('sales-nav')) return 'Sales Navigator';
    if (localLead.enrichment_data?.apollo) return 'Apollo';
    return 'Unknown';
  };

  // Helper to detect PhantomBuster enrichment scenarios
  const getPhantomBusterStatus = (lead) => {
    const leadSource = getLeadSource(lead);
    const enrichmentData = lead.enrichment_data || {};
    
    if (leadSource === 'Sales Navigator') {
      // Sales Navigator leads should have PhantomBuster data
      if (enrichmentData.phantombuster || enrichmentData.sales_navigator) {
        return {
          status: 'enriched',
          message: 'Profile data available from PhantomBuster',
          hasData: true
        };
      } else {
        return {
          status: 'missing',
          message: 'No profile data found. This lead may not have been enriched yet.',
          hasData: false,
          canRetrigger: true
        };
      }
    }
    
    return {
      status: 'not_applicable',
      message: null,
      hasData: true
    };
  };

  // Helper to get enrichment error context
  const getEnrichmentErrorContext = (lead) => {
    const emailInfo = getEmailWithSource(lead);
    const phoneInfo = getPhoneWithSource(lead);
    const enrichmentSources = getEnrichmentSources(lead);
    const hasAnyData = emailInfo || phoneInfo || enrichmentSources.length > 0;
    
    if (!hasAnyData) {
      return {
        type: 'no_data',
        message: 'No contact information available',
        suggestion: 'Try enriching this lead or add contact details manually'
      };
    }
    
    if (!emailInfo) {
      return {
        type: 'missing_email',
        message: 'Email not available',
        suggestion: 'Enrich to find email or add manually'
      };
    }
    
    if (!phoneInfo) {
      return {
        type: 'missing_phone',
        message: 'Phone not available',
        suggestion: 'Contact information partially complete'
      };
    }
    
    return {
      type: 'complete',
      message: 'Contact information available',
      suggestion: null
    };
  };

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

  const handleLinkedInSubmit = async () => {
    if (!localLead?.linkedin_url) {
      showToast('No LinkedIn URL found for this lead', 'error');
      return;
    }

    setIsSubmittingLinkedIn(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE_URL}/linkedin/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          linkedin_url: localLead.linkedin_url,
          message: linkedInMessage.trim() || null,
          campaign_id: localLead.campaign_id || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle insufficient credits specifically
        if (response.status === 402) {
          showToast(`Insufficient credits: Need ${errorData.required} credits, have ${errorData.available}`, 'error');
        } else {
          showToast(errorData.error || 'Failed to queue LinkedIn request', 'error');
        }
        return;
      }

      const responseData = await response.json();
      showToast(`LinkedIn request queued! ${responseData.credits?.remaining || 0} credits remaining`);
      setShowLinkedInModal(false);
      setShowCreditConfirm(false);
      setLinkedInMessage('');
      // Update daily count and credits
      setDailyLinkedInCount(prev => prev + 1);
      if (responseData.credits?.remaining !== undefined) {
        setUserCredits(responseData.credits.remaining);
      }
    } catch (error) {
      showToast(`Failed to queue LinkedIn request: ${error.message}`, 'error');
    } finally {
      setIsSubmittingLinkedIn(false);
    }
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
                <img src={getAvatarUrl(localLead)} alt="Profile Picture" className="w-12 h-12 rounded-full" />
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
              {/* LinkedIn Limit Warning */}
              {dailyLinkedInCount >= 9 && (
                <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-200">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <i className="fa-solid fa-triangle-exclamation text-yellow-400"></i>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-800">
                        ⚠️ You're near your daily LinkedIn request limit ({dailyLinkedInCount}/10). 
                        Requests will pause once the limit is hit.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
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
                    className={`px-4 py-2 rounded-lg flex items-center ${
                      (!localLead?.linkedin_url || dailyLinkedInCount >= 10) 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-linkedin hover:bg-blue-700'
                    } text-white`}
                    onClick={() => {
                      fetchUserCredits();
                      setShowCreditConfirm(true);
                    }}
                    disabled={!localLead?.linkedin_url || dailyLinkedInCount >= 10}
                    style={{backgroundColor: (!localLead?.linkedin_url || dailyLinkedInCount >= 10) ? undefined : '#0077B5'}}
                    title={
                      !localLead?.linkedin_url ? 'No LinkedIn URL available' : 
                      dailyLinkedInCount >= 10 ? 'Daily LinkedIn request limit reached (10/10)' :
                      `Send LinkedIn connection request (${dailyLinkedInCount}/10 used today)`
                    }
                  >
                    <i className="fa-brands fa-linkedin mr-2"></i>
                    LinkedIn Request {dailyLinkedInCount >= 10 && '(Limit Reached)'}
                  </button>
                  {(() => {
                    const emailInfo = getEmailWithSource(localLead);
                    const phantomStatus = getPhantomBusterStatus(localLead);
                    const errorContext = getEnrichmentErrorContext(localLead);
                    const hasAnyEnrichment = isEnriched;
                    const needsEnrichment = !emailInfo || !hasAnyEnrichment;
                    const leadSource = getLeadSource(localLead);
                    
                    // Determine button appearance and behavior
                    let buttonClass, buttonText, tooltipText, flowText;
                    
                    if (leadSource === 'Sales Navigator' && phantomStatus.status === 'missing') {
                      buttonClass = 'bg-blue-50 border border-blue-500 text-blue-700 hover:bg-blue-100';
                      buttonText = 'Enrich Profile';
                      tooltipText = 'Run PhantomBuster to extract Sales Navigator profile data';
                      flowText = 'PhantomBuster';
                    } else if (needsEnrichment) {
                      buttonClass = 'bg-purple-50 border border-purple-500 text-purple-700 hover:bg-purple-100';
                      buttonText = 'Enrich Now';
                      tooltipText = 'Find contact information using Hunter.io → Skrapp.io → Apollo flow';
                      flowText = 'Hunter→Skrapp→Apollo';
                    } else {
                      buttonClass = 'bg-green-50 border border-green-500 text-green-700 hover:bg-green-100';
                      buttonText = 'Re-enrich';
                      tooltipText = 'Re-run enrichment to find additional data or update existing information';
                      flowText = 'Update';
                    }
                    
                    return (
                      <button
                        className={`px-4 py-2 rounded-lg flex items-center disabled:opacity-50 ${buttonClass}`}
                        onClick={handleEnrich}
                        disabled={isEnriching}
                        title={tooltipText}
                      >
                        {isEnriching ? (
                          <svg className="animate-spin h-4 w-4 mr-1 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                          </svg>
                        ) : (
                          <FaWandMagicSparkles className="mr-1" />
                        )}
                        {buttonText}
                        {(needsEnrichment || phantomStatus.status === 'missing') && (
                          <span className={`ml-1 text-xs px-1 rounded ${
                            leadSource === 'Sales Navigator' 
                              ? 'bg-blue-200 text-blue-800' 
                              : 'bg-purple-200 text-purple-800'
                          }`}>
                            {flowText}
                          </span>
                        )}
                      </button>
                    );
                  })()}
                </div>
                {/* Enhanced Enrichment Status Feedback */}
                {(enrichStatus.apollo || enrichStatus.gpt) && (
                  <div className="mt-4 space-y-2">
                    {(() => {
                      const leadSource = getLeadSource(localLead);
                      const phantomStatus = getPhantomBusterStatus(localLead);
                      
                      return (
                        <div className="text-xs text-gray-600 mb-2">
                          <span className="font-medium">Enrichment Strategy:</span>
                          {leadSource === 'Sales Navigator' && phantomStatus.status === 'missing' ? (
                            <span className="ml-1">PhantomBuster → Profile Data Extraction</span>
                          ) : (
                            <span className="ml-1">Hunter.io → Skrapp.io → Apollo (with graceful fallbacks)</span>
                          )}
                        </div>
                      );
                    })()}
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        enrichStatus.apollo === 'success' ? 'bg-green-100 text-green-800' : 
                        enrichStatus.apollo === 'no_results' ? 'bg-yellow-100 text-yellow-800' :
                        enrichStatus.apollo === 'retry' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Contact Enrichment: {
                          enrichStatus.apollo === 'success' ? 'Success' : 
                          enrichStatus.apollo === 'no_results' ? 'No results found' :
                          enrichStatus.apollo === 'retry' ? 'Can retry' :
                          'Service error'
                        }
                      </span>
                      {enrichStatus.apollo === 'retry' && (
                        <button
                          onClick={handleEnrich}
                          disabled={isEnriching}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                          Retry
                        </button>
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
                          enrichStatus.gpt === 'no_results' ? 'No data available' :
                          enrichStatus.gpt === 'retry' ? 'Can retry' :
                          'Analysis failed'
                        }
                      </span>
                      {enrichStatus.gpt === 'retry' && (
                        <button
                          onClick={handleEnrich}
                          disabled={isEnriching}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                    
                    {/* Enhanced status messages with context */}
                    {(enrichStatus.apolloMsg || enrichStatus.gptMsg) && (
                      <div className="text-xs text-gray-600 space-y-1">
                        {enrichStatus.apolloMsg && (
                          <div className="flex items-start space-x-1">
                            <span>•</span>
                            <span>
                              Contact Enrichment: {enrichStatus.apolloMsg}
                              {enrichStatus.apollo === 'no_results' && (
                                <span className="text-gray-500 ml-1">(tried all available sources)</span>
                              )}
                            </span>
                          </div>
                        )}
                        {enrichStatus.gptMsg && (
                          <div className="flex items-start space-x-1">
                            <span>•</span>
                            <span>Profile Analysis: {enrichStatus.gptMsg}</span>
                          </div>
                        )}
                        <div className="mt-2 text-xs text-gray-500 italic">
                          💡 Enrichment uses graceful fallbacks - if one service fails, others are automatically tried
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Profile Sections */}
              <div className="px-6 py-6 space-y-8">
                {/* Enhanced Data Sources Display with Error Handling */}
                {(() => {
                  const phantomStatus = getPhantomBusterStatus(localLead);
                  const errorContext = getEnrichmentErrorContext(localLead);
                  const sources = getEnrichmentSources(localLead);
                  
                  return (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Enrichment Status</h3>
                      
                      {/* PhantomBuster-specific messaging for Sales Navigator leads */}
                      {phantomStatus.status === 'missing' && (
                        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="flex items-start space-x-2">
                            <span className="text-yellow-600 text-sm">⚠️</span>
                            <div className="flex-1">
                              <p className="text-sm text-yellow-800 font-medium">{phantomStatus.message}</p>
                              <p className="text-xs text-yellow-700 mt-1">
                                Sales Navigator leads require PhantomBuster enrichment for complete profile data.
                              </p>
                              {phantomStatus.canRetrigger && (
                                <button 
                                  className="mt-2 text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
                                  onClick={() => console.log('TODO: Trigger PhantomBuster re-run')}
                                >
                                  Re-trigger PhantomBuster
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Regular enrichment sources */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {sources.map((source, index) => (
                          <div
                            key={index}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${source.color}`}
                            title={`Enriched at: ${source.data.enriched_at ? new Date(source.data.enriched_at).toLocaleString() : 'Unknown'}`}
                          >
                            <span className="mr-1">{source.icon}</span>
                            {source.badge}
                          </div>
                        ))}
                        
                        {/* Error state messaging */}
                        {sources.length === 0 && (
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            errorContext.type === 'no_data' ? 'bg-red-100 text-red-800' :
                            errorContext.type === 'missing_email' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            <span className="mr-1">{
                              errorContext.type === 'no_data' ? '❌' :
                              errorContext.type === 'missing_email' ? '📧' :
                              '❓'
                            }</span>
                            {errorContext.message}
                          </div>
                        )}
                      </div>

                      {/* Lead source and suggestion */}
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Lead Source: <span className="font-medium">{getLeadSource(localLead)}</span></div>
                        {errorContext.suggestion && (
                          <div className="text-gray-600 italic">{errorContext.suggestion}</div>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
                          {(() => {
                            const emailInfo = getEmailWithSource(localLead);
                            const errorContext = getEnrichmentErrorContext(localLead);
                            
                            return emailInfo ? (
                              <div className="flex items-center space-x-2 flex-1">
                                <span className="flex-1" title={emailInfo.tooltip}>
                                  {emailInfo.email}
                                </span>
                                <span 
                                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    emailInfo.source === 'Hunter.io' ? 'bg-green-100 text-green-700' :
                                    emailInfo.source === 'Skrapp.io' ? 'bg-blue-100 text-blue-700' :
                                    emailInfo.source === 'Apollo' ? 'bg-purple-100 text-purple-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}
                                  title={`Email source: ${emailInfo.source}${emailInfo.enrichedAt ? ` (${new Date(emailInfo.enrichedAt).toLocaleDateString()})` : ''}`}
                                >
                                  {emailInfo.source}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 flex-1">
                                <span className="flex-1 text-gray-400">
                                  {errorContext.type === 'missing_email' ? 'Email not available' : 'No email found'}
                                </span>
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                                  {errorContext.type === 'missing_email' ? 'Missing' : 'None'}
                                </span>
                              </div>
                            );
                          })()}
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
                          {(() => {
                            const phoneInfo = getPhoneWithSource(localLead);
                            const errorContext = getEnrichmentErrorContext(localLead);
                            
                            return phoneInfo ? (
                              <div className="flex items-center space-x-2 flex-1">
                                <span className="flex-1" title={phoneInfo.tooltip}>
                                  {phoneInfo.phone}
                                </span>
                                <span 
                                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    phoneInfo.source === 'Apollo' ? 'bg-purple-100 text-purple-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}
                                  title={`Phone source: ${phoneInfo.source}${phoneInfo.enrichedAt ? ` (${new Date(phoneInfo.enrichedAt).toLocaleDateString()})` : ''}`}
                                >
                                  {phoneInfo.source}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 flex-1">
                                <span className="flex-1 text-gray-400">
                                  {errorContext.type === 'missing_phone' ? 'Phone not available' : 'No phone found'}
                                </span>
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                                  {errorContext.type === 'missing_phone' ? 'Missing' : 'None'}
                                </span>
                              </div>
                            );
                          })()}
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
                    {/* Profile Analysis / GPT Notes */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">
                          {(() => {
                            const leadSource = getLeadSource(localLead);
                            if (leadSource === 'Sales Navigator') return 'PhantomBuster Profile Data';
                            if (leadSource === 'Apollo') return 'Apollo Profile Summary';
                            return 'Profile Analysis';
                          })()}
                        </h3>
                        {isEnriched && getEnrichmentSources(localLead).length > 0 && (
                          <span className="text-xs text-gray-500">
                            via {getEnrichmentSources(localLead).map(s => s.name).join(', ')}
                          </span>
                        )}
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        {(() => {
                          const phantomStatus = getPhantomBusterStatus(localLead);
                          const leadSource = getLeadSource(localLead);
                          const gptNotes = getGptNotes(localLead);
                          
                          // Handle PhantomBuster-specific scenarios
                          if (leadSource === 'Sales Navigator' && phantomStatus.status === 'missing') {
                            return (
                              <div className="text-center py-6">
                                <div className="text-gray-400 mb-2">👻</div>
                                <p className="text-gray-500 text-sm">No profile data found.</p>
                                <p className="text-gray-400 text-xs mt-1">
                                  This Sales Navigator lead may need PhantomBuster enrichment.
                                </p>
                                <button 
                                  className="mt-3 text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                  onClick={() => console.log('TODO: Trigger PhantomBuster run')}
                                >
                                  Run PhantomBuster Enrichment
                                </button>
                              </div>
                            );
                          }
                          
                          // Regular enrichment display
                          if (isEnriched && gptNotes) {
                            return (
                              <div>
                                <p className="text-gray-600">{gptNotes}</p>
                                {/* Show data source attribution */}
                                {localLead.enrichment_data?.phantombuster && (
                                  <div className="mt-2 text-xs text-blue-600 flex items-center">
                                    <span className="mr-1">👻</span>
                                    Data collected via PhantomBuster Sales Navigator extraction
                                  </div>
                                )}
                                {localLead.enrichment_data?.apollo?.summary && (
                                  <div className="mt-2 text-xs text-purple-600 flex items-center">
                                    <span className="mr-1">🚀</span>
                                    Profile summary generated from Apollo data
                                  </div>
                                )}
                              </div>
                            );
                          }
                          
                          // No enrichment data available
                          if (isEnriched) {
                            return (
                              <div className="text-center py-4">
                                <p className="text-gray-400 text-sm">No profile analysis available.</p>
                                <p className="text-gray-400 text-xs mt-1">
                                  Contact information was found but no detailed profile data.
                                </p>
                              </div>
                            );
                          }
                          
                          // Fallback placeholder content
                          return (
                            <div className="text-center py-6">
                              <div className="text-gray-300 mb-2">📋</div>
                              <p className="text-gray-400 text-sm">Profile analysis will appear here after enrichment.</p>
                              <p className="text-gray-400 text-xs mt-1">
                                Click "Enrich Now" to discover professional background and experience.
                              </p>
                            </div>
                          );
                        })()}
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

      {/* Credit Confirmation Modal */}
      {showCreditConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <i className="fa-solid fa-coins text-yellow-500 mr-2"></i>
              Confirm LinkedIn Request
            </h3>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                You're about to send a LinkedIn connection request to <strong>{localLead.name}</strong>.
              </p>
              
              {/* Credit breakdown */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Current Balance:</span>
                  <span className="font-semibold text-gray-900">{userCredits} credits</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Request Cost:</span>
                  <span className="font-semibold text-red-600">-20 credits</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">After Request:</span>
                  <span className={`font-bold ${userCredits >= 20 ? 'text-green-600' : 'text-red-600'}`}>
                    {userCredits - 20} credits
                  </span>
                </div>
              </div>

              {userCredits < 20 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <div className="flex items-center">
                    <i className="fa-solid fa-exclamation-triangle text-red-500 mr-2"></i>
                    <span className="text-sm text-red-700 font-medium">
                      Insufficient credits to send this request
                    </span>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500">
                <p>💡 Credits are charged when the request is successfully sent via LinkedIn</p>
                <p className="mt-1">⏱️ Requests are processed automatically every 5 minutes</p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreditConfirm(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCreditConfirm(false);
                  setShowLinkedInModal(true);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{backgroundColor: '#0077B5'}}
                disabled={userCredits < 20}
              >
                <i className="fa-brands fa-linkedin mr-2"></i>
                {userCredits < 20 ? 'Insufficient Credits' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn Request Modal */}
      {showLinkedInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Send LinkedIn Request</h3>
            <p className="mb-4 text-gray-600 text-sm">
              Send a connection request to <strong>{localLead.name}</strong> on LinkedIn.
            </p>
            {/* Daily limit indicator */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">
                  Daily LinkedIn Requests
                </span>
                <span className={`text-sm font-bold ${
                  dailyLinkedInCount >= 9 ? 'text-yellow-600' : 'text-blue-600'
                }`}>
                  {dailyLinkedInCount}/10
                </span>
              </div>
              <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    dailyLinkedInCount >= 9 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${(dailyLinkedInCount / 10) * 100}%` }}
                ></div>
              </div>
            </div>


            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personal message (optional)
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Add a personal message to your connection request..."
                maxLength={300}
                rows={4}
                value={linkedInMessage}
                onChange={(e) => setLinkedInMessage(e.target.value)}
              />
              <div className="mt-1 text-xs text-gray-500 text-right">
                {linkedInMessage.length}/300 characters
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowLinkedInModal(false);
                  setLinkedInMessage('');
                  setShowCreditConfirm(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isSubmittingLinkedIn}
              >
                Cancel
              </button>
              <button
                onClick={handleLinkedInSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                style={{backgroundColor: '#0077B5'}}
                disabled={isSubmittingLinkedIn}
              >
                {isSubmittingLinkedIn ? 'Sending Request...' : 'Send LinkedIn Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


