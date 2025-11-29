import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { FaCog } from 'react-icons/fa';
import EditProfileModal from '../components/EditProfileModal';
import { FaWandMagicSparkles } from 'react-icons/fa6';
import { supabase } from '../lib/supabaseClient';
import { replaceTokens } from '../utils/tokenReplace';
import ActivityLogSection from '../components/ActivityLogSection';
import MetadataModal from '../components/MetadataModal';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

// You may want to use react-icons for FontAwesome icons, or keep <i> tags if you have FontAwesome loaded globally

export default function LeadProfileDrawer({ lead, onClose, isOpen, onLeadUpdated, extraHeaderActions, entityType = 'lead' }) {
  const navigate = useNavigate();
  const [isConverting, setIsConverting] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isUnlockingInsights, setIsUnlockingInsights] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState({ apollo: null, gpt: null });
  const [localLead, setLocalLead] = useState(lead);
  const [localCandidate, setLocalCandidate] = useState(lead);
  const lastAppliedRef = useRef(null);
  // refresh daily LI count when drawer opens
  useEffect(() => { if (isOpen) { fetchDailyLinkedInCount(); } }, [isOpen]);
  
  // Force remount on entity change to clear stale closures
  const instanceKey = useMemo(
    () => `${entityType}-${lead?.id ?? "nil"}-${lead?.updated_at ?? ""}`,
    [entityType, lead?.id, lead?.updated_at]
  );

  // Reconcile prop → local state when identity or server-updated timestamp changes
  useEffect(() => {
    // Prevent reverting to stale if a more recent local change was applied
    const incomingStamp = lead?.updated_at ?? "";
    const lastApplied = lastAppliedRef.current ?? "";
    if (incomingStamp >= lastApplied) {
      setLocalLead(lead);
      setLocalCandidate(lead);
    }
  }, [lead?.id, lead?.updated_at, entityType]);
  
  // LinkedIn request modal state
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [linkedInMessage, setLinkedInMessage] = useState('');
  const [isSubmittingLinkedIn, setIsSubmittingLinkedIn] = useState(false);
  const [dailyLinkedInCount, setDailyLinkedInCount] = useState(0);
  const [isLoadingLinkedInCount, setIsLoadingLinkedInCount] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const resumeInputRef = useRef(null);

  // TODO: Re-enable Playwright once stable
  const USE_PLAYWRIGHT_AUTOMATION = false;

  // LinkedIn templates state
  const [liTemplates, setLiTemplates] = useState([]);
  const [selectedLiTemplateId, setSelectedLiTemplateId] = useState('');

  // Extension wait notice state
  const [showExtensionWait, setShowExtensionWait] = useState(false);
  const [extensionCountdown, setExtensionCountdown] = useState(10);
  const extensionTimerRef = React.useRef(null);
  const lastConnectUrlRef = React.useRef('');
  
  // REX Mode state (Prompt 8 enhancement)
  const [rexMode, setRexMode] = useState('manual'); // 'auto' or 'manual'
  const [consentAccepted, setConsentAccepted] = useState(false);

  // User role state for feature gating
  const [userRole, setUserRole] = useState(null);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

  // Edit states for contact fields
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingTwitter, setEditingTwitter] = useState(false);
  const [tempEmail, setTempEmail] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [tempTwitter, setTempTwitter] = useState('');
  // Sequence enrollment UI state
  const [enrollment, setEnrollment] = useState(null);
  const [enrollmentRuns, setEnrollmentRuns] = useState([]);
  const [loadingEnrollment, setLoadingEnrollment] = useState(false);
  const enrollmentLastFetchRef = React.useRef({ leadId: null, at: 0 });
  const enrollmentAbortRef = React.useRef(null);
  const lastLeadFetchRef = React.useRef({ leadId: null, at: 0 });
  const prevIsOpenRef = React.useRef(false);

  useEffect(() => {
    // Parse enrichment_data if it's a string or array-like object
    let parsed = lead;
    if (lead && lead.enrichment_data) {
      if (typeof lead.enrichment_data === 'string') {
        try {
          parsed = { ...lead, enrichment_data: JSON.parse(lead.enrichment_data) };
        } catch (e) {
          parsed = { ...lead, enrichment_data: {} };
        }
      } else {
        // Check if this is a corrupted array-like object (has many numeric keys)
        const keys = Object.keys(lead.enrichment_data);
        const numericKeys = keys.filter(key => !isNaN(key) && key !== 'last_enrichment_attempt');
        
        if (numericKeys.length > 10 && numericKeys.length > keys.length * 0.8) {
          try {
            // Sort numeric keys and reconstruct the JSON string
            const sortedNumericKeys = numericKeys.sort((a, b) => parseInt(a) - parseInt(b));
            const reconstructed = sortedNumericKeys.map(key => lead.enrichment_data[key]).join('');
            
            const parsedEnrichment = JSON.parse(reconstructed);
            
            // Preserve non-numeric fields like last_enrichment_attempt
            const preservedFields = {};
            keys.forEach(key => {
              if (isNaN(key)) {
                preservedFields[key] = lead.enrichment_data[key];
              }
            });
            
            const finalEnrichment = { ...parsedEnrichment, ...preservedFields };
            parsed = { ...lead, enrichment_data: finalEnrichment };
          } catch (e) {
            parsed = { ...lead, enrichment_data: {} };
          }
        }
      }
    }
    setLocalLead(parsed);

    // Detect drawer opening edge to run one-time per open
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    const opening = isOpen && !wasOpen;

    // When drawer opens or lead changes, pull freshest data (throttled)
    if (isOpen && (lead?.lead_id || lead?.id)) {
      // For candidates, use the candidate ID for fetchLatestLead
      // For leads, use the lead ID
      const entityId = entityType === 'candidate' ? lead.id : (lead.lead_id || lead.id);
      const leadId = lead.lead_id || lead.id;

      // Only run these once per open
      if (opening) {
        fetchDailyLinkedInCount();
        fetchUserCredits();
        fetchUserRole();
        fetchLinkedInTemplates();
      }

      const now = Date.now();

      // Throttle latest lead fetch to avoid loops from parent prop churn
      const shouldFetchLead = !lastLeadFetchRef.current
        || lastLeadFetchRef.current.leadId !== entityId
        || now - lastLeadFetchRef.current.at > 10000; // 10s throttle

      if (shouldFetchLead) {
        lastLeadFetchRef.current = { leadId: entityId, at: now };
        // Only fetch if the drawer is opening, not on every prop change
        if (opening) {
          fetchLatestLead(entityId);
        }
      }

      // Throttle enrollment fetch similarly - use leadId for sequence enrollment
      const shouldFetchEnrollment = !enrollmentLastFetchRef.current
        || enrollmentLastFetchRef.current.leadId !== leadId
        || now - enrollmentLastFetchRef.current.at > 10000; // 10s throttle

      if (shouldFetchEnrollment) {
        enrollmentLastFetchRef.current = { leadId: leadId, at: now };
        fetchSequenceEnrollment(leadId);
      }
    }
  }, [isOpen, lead?.id, lead?.lead_id, entityType]);

  // Toast helper (replace with your own toast if needed)
  const showToast = (msg, type = 'success') => {
    window.alert(msg); // Replace with your toast system
  };

  // Helper function to get the current local state based on entity type
  const getCurrentLocal = () => {
    return entityType === 'candidate' ? localCandidate : localLead;
  };

  // Helper to validate LinkedIn profile URLs and build extension trigger URL
  const isValidLinkedInProfileUrl = (profileUrl) => {
    try {
      const parsed = new URL(profileUrl);
      if (parsed.hostname !== 'www.linkedin.com') return false;
      return parsed.pathname.startsWith('/in/');
    } catch {
      return false;
    }
  };

  const buildExtensionConnectUrl = (profileUrl) => {
    try {
      const u = new URL(profileUrl);
      u.searchParams.set('hirepilot_connect', '1');
      return u.toString();
    } catch {
      return null;
    }
  };

  // Temporary bypass handler: prefer Chrome extension over Playwright
  const handleLinkedInRequestClick = () => {
    const linkedinUrl = getLinkedInUrl(localLead);
    if (!linkedinUrl) {
      showToast('No LinkedIn URL found for this lead', 'error');
      return;
    }
    if (!isValidLinkedInProfileUrl(linkedinUrl)) {
      showToast('Invalid LinkedIn URL.', 'error');
      return;
    }

    if (USE_PLAYWRIGHT_AUTOMATION) {
      // TODO: Re-enable Playwright once stable
      if (shouldShowComingSoon()) {
        setShowComingSoonModal(true);
      } else {
        fetchUserCredits();
        setShowCreditConfirm(true);
      }
      return;
    }

    const connectUrl = buildExtensionConnectUrl(linkedinUrl);
    if (!connectUrl) {
      showToast('Invalid LinkedIn URL.', 'error');
      return;
    }

    // Open modal to compose/select template before triggering extension
    setShowLinkedInModal(true);

    // Bonus: notify user about extension handling
    showToast("Your LinkedIn connection request is being handled by the Chrome Extension. Ensure it's installed.", 'info');
  };

  const fetchSequenceEnrollment = async (id) => {
    try {
      // Abort any in-flight request to prevent race/flicker
      if (enrollmentAbortRef.current) {
        try { enrollmentAbortRef.current.abort(); } catch {}
      }
      const controller = new AbortController();
      enrollmentAbortRef.current = controller;
      setLoadingEnrollment(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // For candidates, we need to use the lead_id for sequence enrollment API
      const leadId = entityType === 'candidate' ? localLead.lead_id : id;
      
      // Skip sequence enrollment for candidates without lead_id
      if (entityType === 'candidate' && !leadId) {
        setEnrollment(null);
        setEnrollmentRuns([]);
        return;
      }
      
      const res = await fetch(`${API_BASE_URL}/sequence-enrollments/by-lead/${leadId}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        signal: controller.signal
      });
      if (res.ok){
        const json = await res.json();
        setEnrollment(json.enrollment || null);
        setEnrollmentRuns(json.runs || []);
      } else {
        setEnrollment(null);
        setEnrollmentRuns([]);
      }
    } catch {
      setEnrollment(null);
      setEnrollmentRuns([]);
    } finally {
      setLoadingEnrollment(false);
    }
  };

  // All roles are allowed to use LinkedIn Request
  const shouldShowComingSoon = () => false;

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
        credentials: 'include'
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

  // Fetch LinkedIn templates (we use email_templates with subject = 'linkedin_request')
  const fetchLinkedInTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('email_templates')
        .select('id,name,subject,content,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        const onlyLinkedIn = (data || []).filter(t => (t.subject || '').toLowerCase() === 'linkedin_request');
        setLiTemplates(onlyLinkedIn);
      }
    } catch (e) {
      // ignore
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

  // Fetch user role
  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to fetch from users table first
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (data && data.role) {
        setUserRole(data.role);
      } else if (user.user_metadata?.role) {
        setUserRole(user.user_metadata.role);
      } else if (user.user_metadata?.account_type) {
        setUserRole(user.user_metadata.account_type);
      }
    } catch (error) {
      console.error('Failed to fetch user role:', error);
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
      
      // Use appropriate local state based on entity type
      const currentLocal = entityType === 'candidate' ? localCandidate : localLead;
      const setCurrentLocal = entityType === 'candidate' ? setLocalCandidate : setLocalLead;
      
      // Optimistic update
      const updatedLocal = { ...currentLocal, [field]: value };
      setCurrentLocal(updatedLocal);
      onLeadUpdated?.(updatedLocal);

      // Use different API endpoints based on entity type
      const idToUse = currentLocal.id;
      const endpoint = entityType === "candidate"
        ? `${API_BASE_URL}/candidates/${idToUse}`
        : `${API_BASE_URL}/leads/${idToUse}`;

      const response = await fetch(endpoint, {
        method: entityType === "candidate" ? "PUT" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          [field]: value, 
          ...(currentLocal.lead_id ? { lead_id: currentLocal.lead_id } : {}) 
        }),
        credentials: "include",
      });

      if (!response.ok) {
        // Rollback on failure
        setCurrentLocal(currentLocal);
        const errorText = await response.text();
        throw new Error(`Failed to update ${entityType}: ${errorText}`);
      }
      
      const parsed = await response.json();

      // Mark the timestamp we just applied (prevents stale overwrite later)
      const appliedStamp = parsed?.updated_at ?? new Date().toISOString();
      lastAppliedRef.current = appliedStamp;

      // DO NOT immediately refetch; let the single source of truth be parsed
      setCurrentLocal(parsed);
      onLeadUpdated?.(parsed);
      showToast(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`);
    } catch (error) {
      showToast(`Failed to update ${field}: ${error.message}`, 'error');
    }
  };

  // Re-enrich candidate handler
  const reEnrichCandidate = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const currentLocal = getCurrentLocal();
      if (!currentLocal?.id) throw new Error('No candidate ID available');

      showToast('Re-enriching candidate data...', 'info');
      
      const response = await fetch(`${API_BASE_URL}/candidates/${currentLocal.id}/enrich`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to re-enrich: ${errorText}`);
      }
      
      const enriched = await response.json();
      // Merge enriched fields if provided
      const updated = { 
        ...currentLocal,
        email: enriched?.email ?? currentLocal.email,
        phone: enriched?.phone ?? currentLocal.phone,
        linkedin_url: enriched?.linkedin || currentLocal.linkedin_url,
      };
      setLocalCandidate(updated);
      onLeadUpdated?.(updated);
      
      showToast('Candidate re-enriched successfully!', 'success');
    } catch (error) {
      console.error('Re-enrich failed:', error);
      showToast(`Re-enrich failed: ${error.message}`, 'error');
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
      
      // For candidates, use lead_id for the convert API call
      const leadId = entityType === 'candidate' ? localLead.lead_id : localLead.id;
      
      const response = await fetch(`${API_BASE_URL}/leads/${leadId}/convert`, {
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

  const handleConvertToClient = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      // Build payload from lead + enrichment
      const enrich = (localLead?.enrichment_data || {});
      const company = getEnrichedCompany(localLead) || enrich?.apollo?.organization?.name || localLead?.company || '';
      const location = getEnrichedLocation(localLead) || enrich?.apollo?.organization?.location || null;
      const domain = enrich?.apollo?.organization?.website_url || null;
      const industry = enrich?.apollo?.organization?.industry || null;
      const owner_id = session.user.id;
      const contacts = [];
      const emailInfo = getEmailWithSource(localLead);
      if (getDisplayName(localLead) || emailInfo?.email) {
        contacts.push({
          name: getDisplayName(localLead) || '',
          title: getEnrichedTitle(localLead) || null,
          email: emailInfo?.email || null,
          phone: localLead?.phone || null,
        });
      }
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: company, domain, industry, location, owner_id })
      });
      if (!resp.ok) throw new Error('Failed to create client');
      const client = await resp.json();
      if (contacts.length) {
        for (const c of contacts) {
          await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ ...c, client_id: client.id })
          }).catch(()=>{});
        }
      }
      showToast('Client created from lead', 'success');
    } catch (e) {
      showToast(e.message || 'Conversion failed', 'error');
    }
  };

  // Helper to get display name with Apollo fallback
  const getDisplayName = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    
    // Prioritize Apollo enrichment data
    if (enrichmentData.apollo?.first_name && enrichmentData.apollo?.last_name) {
      return `${enrichmentData.apollo.first_name} ${enrichmentData.apollo.last_name}`;
    }
    if (enrichmentData.apollo?.first_name) return enrichmentData.apollo.first_name;
    
    // Fallback to direct lead properties
    if (lead.first_name && lead.last_name) return `${lead.first_name} ${lead.last_name}`;
    if (lead.first_name) return lead.first_name;
    if (lead.name) return lead.name;
    return '';
  };

  // Helper to generate avatar URL with Apollo photo fallback
  const getAvatarUrl = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    
    // Use Apollo photo if available
    if (enrichmentData.apollo?.photo_url) {
      return enrichmentData.apollo.photo_url;
    }
    
    // Fallback to generated avatar
    const name = getDisplayName(lead);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  };

  // Helper to get LinkedIn URL with Apollo fallback
  const getLinkedInUrl = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    
    // Prioritize Apollo LinkedIn URL
    if (enrichmentData.apollo?.linkedin_url) {
      return enrichmentData.apollo.linkedin_url;
    }
    
    // Fallback to direct properties
    return lead.linkedin_url || lead.linkedin || '';
  };

  // Helper to get enriched title with Apollo fallback
  const getEnrichedTitle = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    
    // Prioritize Apollo title
    if (enrichmentData.apollo?.title) {
      return enrichmentData.apollo.title;
    }
    
    // Fallback to direct properties
    return lead.title || '';
  };

  // Helper to get enriched company with Apollo fallback
  const getEnrichedCompany = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    
    // Prioritize Apollo organization name
    if (enrichmentData.apollo?.organization?.name) {
      return enrichmentData.apollo.organization.name;
    }
    
    // Fallback to direct properties
    return lead.company || '';
  };

  // Helper to get enriched location with Apollo fallback
  const getEnrichedLocation = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    
    // Prioritize Apollo location
    if (enrichmentData.apollo?.location) {
      const { city, state, country } = enrichmentData.apollo.location;
      const parts = [];
      if (city) parts.push(city);
      if (state) parts.push(state);
      if (country && country !== 'United States') parts.push(country);
      return parts.join(', ');
    }
    
    // Fallback to direct properties
    return lead.location || '';
  };

  // Helper to get Apollo functions and departments
  const getApolloFunctionsAndDepartments = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    const items = [];
    
    if (enrichmentData.apollo?.department) {
      items.push({ type: 'department', value: enrichmentData.apollo.department });
    }
    
    if (enrichmentData.apollo?.subdepartments?.length > 0) {
      enrichmentData.apollo.subdepartments.forEach(subdept => {
        items.push({ type: 'subdepartment', value: subdept });
      });
    }
    
    if (enrichmentData.apollo?.seniority) {
      items.push({ type: 'seniority', value: enrichmentData.apollo.seniority });
    }
    
    return items;
  };

  // Helper to get Apollo social profiles
  const getApolloSocialProfiles = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    const profiles = [];
    
    if (enrichmentData.apollo) {
      const { twitter_url, facebook_url, github_url } = enrichmentData.apollo;
      if (twitter_url) profiles.push({ type: 'twitter', url: twitter_url, icon: 'fa-brands fa-x-twitter' });
      if (facebook_url) profiles.push({ type: 'facebook', url: facebook_url, icon: 'fa-brands fa-facebook' });
      if (github_url) profiles.push({ type: 'github', url: github_url, icon: 'fa-brands fa-github' });
    }
    
    return profiles;
  };

  // Helper to get Apollo enrichment timestamp
  const getApolloEnrichmentTimestamp = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    return enrichmentData.apollo?.enriched_at || null;
  };

  // Helper to get work history from Apollo data
  const getWorkHistory = (lead) => {
    if (
      lead.enrichment_data?.apollo?.employment_history &&
      Array.isArray(lead.enrichment_data.apollo.employment_history) &&
      lead.enrichment_data.apollo.employment_history.length > 0
    ) {
      // Map Apollo employment_history to a common format
      return lead.enrichment_data.apollo.employment_history.map(exp => ({
        company: exp.organization_name || exp.company,
        title: exp.title,
        years: (exp.start_date ? new Date(exp.start_date).getFullYear() : '') +
               (exp.end_date ? ` - ${new Date(exp.end_date).getFullYear()}` : exp.current ? ' - Present' : ''),
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
    // Check for fallback data sources
    if (lead.skills && lead.skills.length > 0) return lead.skills;
    if (lead.enrichment_data && Array.isArray(lead.enrichment_data.skills) && lead.enrichment_data.skills.length > 0) return lead.enrichment_data.skills;
    
    // Extract skills from Apollo functions/departments as a fallback
    const enrichmentData = lead.enrichment_data || {};
    const skillsFromApollo = [];
    if (enrichmentData.apollo?.functions) {
      skillsFromApollo.push(...enrichmentData.apollo.functions);
    }
    if (enrichmentData.apollo?.departments) {
      skillsFromApollo.push(...enrichmentData.apollo.departments);
    }
    if (skillsFromApollo.length > 0) {
      return skillsFromApollo;
    }
    
    return [];
  };

  // Enhanced Company Insights helpers (from existing Apollo organization payload)
  const getOrganization = (lead) => lead?.enrichment_data?.apollo?.organization || null;
  const getAnnualRevenue = (org) =>
    org?.organization_revenue_printed ||
    org?.organization_revenue ||
    org?.estimated_annual_revenue ||
    org?.annual_revenue_printed ||
    org?.annual_revenue ||
    null;
  const getFunding = (lead) => {
    const apollo = lead?.enrichment_data?.apollo || {};
    const org = apollo.organization || {};
    const stage = apollo.latest_funding_stage || org.latest_funding_stage || null;
    const total = apollo.total_funding_printed || org.total_funding_printed || apollo.total_funding || org.total_funding || null;
    return { stage, total };
  };
  const getFoundedYear = (org) => org?.founded_year || null;
  const getIndustry = (org) => org?.industry || null;
  const getKeywords = (org) => Array.isArray(org?.keywords) ? org.keywords.slice(0, 10) : [];
  const getTechnologies = (lead) => {
    const org = lead?.enrichment_data?.apollo?.organization || {};
    const techA = Array.isArray(org.technology_names)
      ? org.technology_names.map(t => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
      : [];
    const techB = Array.isArray(org.current_technologies)
      ? org.current_technologies.map(t => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
      : [];
    return Array.from(new Set([...techA, ...techB])).slice(0, 8);
  };

  const getEnhancedCompany = (lead) => {
    if (!lead) return null;
    if (lead.enhanced_insights?.company) return lead.enhanced_insights.company;
    const preferredProvider =
      lead?.enhanced_insights_status?.provider ||
      (lead?.enrichment_data?.apollo ? 'apollo' : lead?.enrichment_data?.skrapp ? 'skrapp' : null);

    if (preferredProvider === 'apollo') {
      const org = getOrganization(lead);
      if (!org) return null;
      const funding = getFunding(lead);
      return {
        name: org?.name || lead?.company || null,
        domain: org?.domain || org?.website_url || null,
        revenue_range: getAnnualRevenue(org),
        employee_count: org?.employee_count || org?.estimated_num_employees || null,
        employee_range: org?.employee_count_range || org?.estimated_num_employees || null,
        industry: org?.industry || null,
        headquarters: org?.location || org?.headquarters || null,
        funding_total: funding?.total || null,
        last_funding_round: funding?.stage || org?.last_funding_type || null,
        last_funding_amount: org?.last_funding_amount || null,
        technologies: getTechnologies(lead),
        keywords: getKeywords(org)
      };
    }

    if (preferredProvider === 'skrapp') {
      const skrapp = lead?.enrichment_data?.skrapp;
      if (!skrapp) return null;
      return {
        name: skrapp?.company_name || skrapp?.name || lead?.company || null,
        domain: skrapp?.company_domain || skrapp?.domain || null,
        revenue_range: skrapp?.company_revenue_range || skrapp?.revenue_range || null,
        employee_count: skrapp?.company_employee_count || null,
        employee_range: skrapp?.company_employee_range || skrapp?.company_size || null,
        industry: skrapp?.company_industry || skrapp?.industry || null,
        headquarters: skrapp?.company_headquarters || skrapp?.headquarters || null,
        funding_total: skrapp?.company_funding || null,
        last_funding_round: skrapp?.last_funding_round || null,
        last_funding_amount: skrapp?.last_funding_amount || null,
        technologies: Array.isArray(skrapp?.technologies) ? skrapp.technologies : null,
        keywords: Array.isArray(skrapp?.keywords) ? skrapp.keywords : null
      };
    }

    return null;
  };

  // Determine if we actually have any enhanced org data to show
  const hasEnhancedOrgData = (lead) => {
    const company = getEnhancedCompany(lead);
    if (!company) return false;
    if (company.revenue_range) return true;
    if (company.employee_range || company.employee_count) return true;
    if (company.industry) return true;
    if (company.headquarters) return true;
    if (company.funding_total || company.last_funding_round || company.last_funding_amount) return true;
    if (Array.isArray(company.technologies) && company.technologies.length > 0) return true;
    if (Array.isArray(company.keywords) && company.keywords.length > 0) return true;
    return false;
  };

  // Funding events helper
  const getFundingEvents = (lead) => {
    const events = lead?.enrichment_data?.apollo?.organization?.funding_events;
    return Array.isArray(events) ? events : [];
  };

  // Quick jump into REX with filter intent
  const openRexWithFilter = async (kind, value) => {
    try {
      const { data: { session, user } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const text = kind === 'tech'
        ? `search my database for contacts at companies using ${value}; requires_enhanced = true; show top 25`
        : `search my database for contacts at companies with keyword "${value}"; requires_enhanced = true; show top 25`;
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rex/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: user?.id, messages: [{ role: 'user', content: text }] })
      }).catch(()=>{});
      window.open('/rex-chat', '_blank');
    } catch (e) {
      showToast('Failed to open REX', 'error');
    }
  };

  // NEW: Helper to detect enrichment sources and get metadata
  const getEnrichmentSources = (lead) => {
    const sources = [];
    const enrichmentData = lead.enrichment_data || {};

    if (enrichmentData.decodo) {
      sources.push({
        type: 'decodo',
        name: 'Decodo',
        data: enrichmentData.decodo,
        badge: 'Profile via Decodo',
        color: 'bg-indigo-100 text-indigo-800',
        icon: '🔍'
      });
    }

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

    if (enrichmentData.phantombuster || enrichmentData.sales_navigator) {
      sources.push({
        type: 'phantombuster',
        name: 'PhantomBuster',
        data: enrichmentData.phantombuster || enrichmentData.sales_navigator,
        badge: 'Enriched via PhantomBuster',
        color: 'bg-gray-100 text-gray-800',
        icon: '👻'
      });
    }

    return sources;
  };

  const getEnrichmentStatusSummary = (lead) => {
    if (!lead) return null;
    if (lead.enrichment_status) return lead.enrichment_status;
    const lastAttempt = lead?.enrichment_data?.last_enrichment_attempt;
    if (!lastAttempt) return null;
    return {
      source: lastAttempt.source || 'none',
      success: Boolean(lastAttempt.source && lastAttempt.source !== 'none'),
      errors: Array.isArray(lastAttempt.errors) ? lastAttempt.errors : []
    };
  };

  const formatEnrichmentSourceLabel = (source) => {
    switch (source) {
      case 'apollo':
        return 'Enriched via Apollo';
      case 'skrapp':
        return 'Enriched via Skrapp';
      case 'decodo':
        return 'Enriched via LinkedIn (Decodo)';
      case 'hunter':
        return 'Email via Hunter.io';
      default:
        return source && source !== 'none' ? `Enriched via ${source}` : 'Enrichment pending';
    }
  };

  const enrichmentSourceChipColor = (source) => {
    switch (source) {
      case 'apollo':
        return 'bg-purple-500/10 text-purple-200';
      case 'skrapp':
        return 'bg-blue-500/10 text-blue-200';
      case 'decodo':
        return 'bg-indigo-500/10 text-indigo-200';
      case 'hunter':
        return 'bg-green-500/10 text-green-200';
      default:
        return 'bg-gray-700 text-gray-200';
    }
  };

  // Helper to determine if lead is enriched – any non-empty enrichment_data counts
  const isEnriched = Boolean(
    localLead.enrichment_data && Object.keys(localLead.enrichment_data).length > 0
  );
  const enrichmentStatusSummary = getEnrichmentStatusSummary(localLead);
  const enhancedStatus = localLead?.enhanced_insights_status || null;
  const enhancedUnlocked = Boolean(enhancedStatus?.unlocked || localLead?.enhanced_insights_unlocked || localLead?.has_enhanced_enrichment);
  const enhancedProvider = enhancedStatus?.provider ||
    localLead?.enhanced_insights?.provider ||
    (localLead?.enrichment_data?.apollo ? 'apollo' : localLead?.enrichment_data?.skrapp ? 'skrapp' : null);
  const enhancedCompany = getEnhancedCompany(localLead);
  const enhancedDataAvailable = hasEnhancedOrgData(localLead);

  // Debug logging removed for performance

  // Helper to get the primary email source with tooltip info
  const getEmailWithSource = (lead) => {
    const enrichmentData = lead.enrichment_data || {};
    
    // PRIORITY 1: Direct email field (user-updated email takes precedence)
    if (lead.email) {
      return {
        email: lead.email,
        source: 'User',
        tooltip: `Email updated by user`,
        enrichedAt: null
      };
    }
    
    // PRIORITY 2: Check if email came from Decodo
    if (enrichmentData.decodo?.email) {
      return {
        email: enrichmentData.decodo.email,
        source: 'Decodo',
        tooltip: `Email found via Decodo profile scraping`,
        enrichedAt: enrichmentData.decodo.enriched_at
      };
    }

    // PRIORITY 3: Check if email came from Hunter.io
    if (enrichmentData.hunter?.email) {
      return {
        email: enrichmentData.hunter.email,
        source: 'Hunter.io',
        tooltip: `Email found via Hunter.io with confidence score`,
        enrichedAt: enrichmentData.hunter.enriched_at
      };
    }

    // PRIORITY 4: Check if email came from Skrapp.io
    if (enrichmentData.skrapp?.email) {
      return {
        email: enrichmentData.skrapp.email,
        source: 'Skrapp.io',
        tooltip: `Email found via Skrapp.io with high confidence`,
        enrichedAt: enrichmentData.skrapp.enriched_at
      };
    }

    // PRIORITY 5: Check if email came from Apollo
    if (enrichmentData.apollo?.email && !enrichmentData.apollo.email.includes('email_not_unlocked')) {
      return {
        email: enrichmentData.apollo.email,
        source: 'Apollo',
        tooltip: `Email found via Apollo enrichment`,
        enrichedAt: enrichmentData.apollo.enriched_at
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
    const linkedinUrl = getLinkedInUrl(lead);
    if (linkedinUrl && linkedinUrl.includes('sales-nav')) return 'Sales Navigator';
    if (lead.enrichment_data?.apollo) return 'Apollo';
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

  // Add a function to fetch the latest lead/candidate data
  const fetchLatestLead = async (id) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const accessToken = session.access_token;
      
      // Use different API endpoints based on entity type
      const apiEndpoint = entityType === 'candidate' 
        ? `${API_BASE_URL}/candidates/${id}`
        : `${API_BASE_URL}/leads/${id}`;
      
      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
      if (!response.ok) return;
      const latest = await response.json();
      // Parse enrichment_data if it's a string or array-like object
      let parsed = latest;
      if (latest && latest.enrichment_data) {
        if (typeof latest.enrichment_data === 'string') {
          try {
            parsed = { ...latest, enrichment_data: JSON.parse(latest.enrichment_data) };
          } catch (e) {
            parsed = { ...latest, enrichment_data: {} };
          }
        } else {
          // Check if this is a corrupted array-like object (has many numeric keys)
          const keys = Object.keys(latest.enrichment_data);
          const numericKeys = keys.filter(key => !isNaN(key) && key !== 'last_enrichment_attempt');
          
          if (numericKeys.length > 10 && numericKeys.length > keys.length * 0.8) {
            try {
              // Sort numeric keys and reconstruct the JSON string
              const sortedNumericKeys = numericKeys.sort((a, b) => parseInt(a) - parseInt(b));
              const reconstructed = sortedNumericKeys.map(key => latest.enrichment_data[key]).join('');
              const parsedEnrichment = JSON.parse(reconstructed);
              
              // Preserve non-numeric fields
              const preservedFields = {};
              keys.forEach(key => {
                if (isNaN(key)) {
                  preservedFields[key] = latest.enrichment_data[key];
                }
              });
              
              const finalEnrichment = { ...parsedEnrichment, ...preservedFields };
              parsed = { ...latest, enrichment_data: finalEnrichment };
            } catch (e) {
              parsed = { ...latest, enrichment_data: {} };
            }
          }
        }
      }
      setLocalLead(parsed);
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
      
      // Always use unified leads enrich endpoint; it accepts either a lead id
      // or a candidate id and falls back internally to candidate lookup.
      const response = await fetch(
        `${API_BASE_URL}/leads/${localLead.id}/enrich`,
      {
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
      // Note: Don't fetch latest lead here as it might overwrite with stale data
      // The localLead state is already updated with the correct data
      
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

  const handleUnlockEnhancedInsights = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast('Please sign in to continue', 'error');
        return;
      }
      const accessToken = session.access_token;
      const leadId = entityType === 'candidate'
        ? (localLead.lead_id || localLead.id)
        : localLead.id;
      if (!leadId) {
        showToast('Unable to determine lead id for this record.', 'error');
        return;
      }

      setIsUnlockingInsights(true);
      const response = await fetch(`${API_BASE_URL}/leads/${leadId}/enhanced-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          showToast(errorData.message || 'You don’t have enough credits to unlock Enhanced Insights. Upgrade or add credits to continue.', 'error');
        } else if (response.status === 400) {
          showToast(errorData.message || 'Please enrich this profile first before unlocking Enhanced Insights.', 'error');
        } else {
          showToast(errorData.message || 'Failed to unlock enhanced insights', 'error');
        }
        return;
      }

      const updated = await response.json();
      lastAppliedRef.current = updated?.updated_at || new Date().toISOString();
      setLocalLead((prev) => ({ ...prev, ...updated }));
      setLocalCandidate((prev) => ({ ...prev, ...updated }));
      onLeadUpdated?.(updated);
      showToast('Enhanced insights unlocked!', 'success');
    } catch (error) {
      showToast(error?.message || 'Failed to unlock enhanced insights', 'error');
    } finally {
      setIsUnlockingInsights(false);
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
    // Validate consent checkbox
    if (!consentAccepted) {
      showToast('You must consent to HirePilot acting on your behalf for LinkedIn automation', 'error');
      return;
    }

    // Build token data and determine message (custom or template), applying token replacement in both cases
    const tokenData = {
      Candidate: {
        FirstName: getDisplayName(localLead)?.split(' ')[0] || '',
        LastName: (getDisplayName(localLead)?.split(' ').slice(1).join(' ')) || '',
        Company: getEnrichedCompany(localLead) || localLead.company || '',
        Job: getEnrichedTitle(localLead) || localLead.title || '',
        Email: localLead.email || '',
        LinkedIn: getLinkedInUrl(localLead) || ''
      },
      first_name: getDisplayName(localLead)?.split(' ')[0] || '',
      last_name: (getDisplayName(localLead)?.split(' ').slice(1).join(' ')) || '',
      full_name: getDisplayName(localLead) || '',
      company: getEnrichedCompany(localLead) || localLead.company || '',
      title: getEnrichedTitle(localLead) || localLead.title || '',
      email: localLead.email || ''
    };

    let message = (linkedInMessage || '').trim();
    if (!message && selectedLiTemplateId) {
      const tpl = liTemplates.find(t => t.id === selectedLiTemplateId);
      if (tpl) {
        message = tpl.content || '';
      }
    }
    if (message) {
      message = replaceTokens(message, tokenData).slice(0, 300);
    }

    if (!message) {
      showToast('Please provide a message or select a template', 'error');
      return;
    }
    if (message.length > 300) {
      showToast('Message cannot exceed 300 characters', 'error');
      return;
    }

    // If Playwright path enabled, fallback to existing automation submit
    if (USE_PLAYWRIGHT_AUTOMATION) {
      // Fall back to previous automation flow
      // Note: keeping the old request path is out of scope for this temporary change
      return;
    }

    // Otherwise, open LinkedIn with extension param and pass message/template metadata
    try {
      const linkedinUrl = getLinkedInUrl(localLead);
      const u = new URL(linkedinUrl);
      u.searchParams.set('hirepilot_connect', '1');
      if (selectedLiTemplateId) {
        u.searchParams.set('hp_tpl', selectedLiTemplateId);
      }
      if (message) {
        u.searchParams.set('hp_msg', message);
      }
      const finalUrl = u.toString();
      lastConnectUrlRef.current = finalUrl;
      window.open(finalUrl, '_blank');
      showToast('Opening LinkedIn profile. Chrome Extension will send your request.', 'info');
      // UX: show a 10-second wait banner with countdown and a Retry button
      setShowExtensionWait(true);
      setExtensionCountdown(10);
      if (extensionTimerRef.current) {
        clearInterval(extensionTimerRef.current);
      }
      extensionTimerRef.current = setInterval(() => {
        setExtensionCountdown(prev => {
          if (prev <= 1) {
            clearInterval(extensionTimerRef.current);
            extensionTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setShowLinkedInModal(false);
      setLinkedInMessage('');
      setSelectedLiTemplateId('');

      // Charge 5 credits and refresh daily count in background
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch(`${API_BASE_URL}/linkedin/record-connect`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          fetchDailyLinkedInCount();
          fetchUserCredits();
        }
      } catch {}
    } catch (e) {
      showToast('Failed to open LinkedIn profile', 'error');
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
          <div key={instanceKey} className={`pointer-events-auto w-[768px] h-full transition-transform duration-300 transform bg-white shadow-xl flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
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
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-semibold">{getDisplayName(localLead) || "Name"}</h2>
                    {localLead.enrichment_data?.apollo && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800" title="Profile enhanced via Apollo">
                        <span className="mr-1">🚀</span>
                        Apollo
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">{getEnrichedTitle(localLead) || "Title"}</p>
                  {getEnrichedCompany(localLead) && (
                    <p className="text-sm text-gray-500">{getEnrichedCompany(localLead)}</p>
                  )}
                  {getEnrichedLocation(localLead) && (
                    <p className="text-xs text-gray-400 flex items-center mt-1">
                      <i className="fa-solid fa-location-dot mr-1"></i>
                      {getEnrichedLocation(localLead)}
                    </p>
                  )}
                  {getApolloEnrichmentTimestamp(localLead) && (
                    <p className="text-xs text-gray-400 mt-1">
                      Enriched {new Date(getApolloEnrichmentTimestamp(localLead)).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {extraHeaderActions}
                {/* Metadata icon to open developer IDs */}
                <button className="text-gray-400 hover:text-gray-600" title="Developer metadata" onClick={() => setShowMetadata(true)}>
                  <FaCog />
                </button>
                <button className="text-gray-400 hover:text-gray-500" onClick={()=> setShowEditModal(true)} title="Edit profile">
                  <i className="fa-solid fa-pen-to-square text-lg"></i>
                </button>
                {/* Close Drawer Button */}
                <button className="text-gray-400 hover:text-gray-500 text-2xl ml-2" onClick={onClose} aria-label="Close drawer">
                  <FiX />
                </button>
              </div>
            </div>
            {/* Compact Enrich control below header icons */}
            <div className="px-6 pt-3 pb-2 border-b border-gray-100 flex justify-end">
              <button
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 border ${isEnriching ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'}`}
                onClick={handleEnrich}
                disabled={isEnriching}
                title="Find or update contact data"
              >
                {isEnriching ? (
                  <svg className="animate-spin h-4 w-4 text-purple-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                ) : (
                  <FaWandMagicSparkles className="text-purple-600" />
                )}
                {isEnriching ? 'Enriching…' : 'Enrich'}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Extension wait banner */}
              {showExtensionWait && (
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-blue-800">
                    <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                    <span>
                      Opening LinkedIn... Extension will auto-connect in ~5-10s. Keep the tab open. {extensionCountdown ? `(~${extensionCountdown}s)` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 text-sm bg-white border border-blue-300 rounded hover:bg-blue-100"
                      onClick={() => {
                        // Retry by reopening the last URL with params if available
                        if (lastConnectUrlRef.current) {
                          window.open(lastConnectUrlRef.current, '_blank');
                        }
                      }}
                    >
                      Retry
                    </button>
                    <button
                      className="px-3 py-1 text-sm text-blue-700 hover:text-blue-900"
                      onClick={() => {
                        setShowExtensionWait(false);
                        if (extensionTimerRef.current) {
                          clearInterval(extensionTimerRef.current);
                          extensionTimerRef.current = null;
                        }
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              {/* LinkedIn Limit Warning */}
              {dailyLinkedInCount >= 18 && (
                <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-200">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <i className="fa-solid fa-triangle-exclamation text-yellow-400"></i>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-800">
                        ⚠️ You're near your daily LinkedIn request limit ({dailyLinkedInCount}/20). 
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center whitespace-nowrap shrink-0"
                    onClick={handleMessageAgain}
                  >
                    <i className="fa-regular fa-paper-plane mr-2"></i>
                    Message
                  </button>
                  {/* Resume upload/view - always visible for candidates */}
                  {entityType === 'candidate' && (
                    <div className="flex items-center gap-2">
                      <input
                        ref={resumeInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !localLead?.id) return;
                          setUploadingResume(true);
                          try {
                            const toBase64 = (f) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(f); });
                            const dataUrl = await toBase64(file);
                            const { data: { session } } = await supabase.auth.getSession();
                            const token = session?.access_token || '';
                            const resp = await fetch(`${API_BASE_URL}/leads/candidates/${localLead.id}/resume`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                              credentials: 'include',
                              body: JSON.stringify({ file: { name: file.name, data: String(dataUrl) } })
                            });
                            const js = await resp.json().catch(() => ({}));
                            if (!resp.ok) throw new Error(js?.error || 'Upload failed');
                            const updated = js?.candidate || {};
                            // Update local state and bubble up
                            const next = { ...(localLead || {}), ...(updated || {}), resume_url: (updated?.resume_url || localLead?.resume_url) };
                            setLocalLead(next);
                            setLocalCandidate(next);
                            lastAppliedRef.current = next.updated_at || new Date().toISOString();
                            if (typeof onLeadUpdated === 'function') onLeadUpdated(next);
                          } catch (err) {
                            alert((err && err.message) || 'Upload failed');
                          } finally {
                            setUploadingResume(false);
                            if (e.target) e.target.value = '';
                          }
                        }}
                      />
                      <button
                        className={`px-4 py-2 ${uploadingResume ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg flex items-center whitespace-nowrap shrink-0`}
                        onClick={(ev) => { ev.stopPropagation(); resumeInputRef.current && resumeInputRef.current.click(); }}
                        disabled={uploadingResume}
                        title="Upload resume file"
                      >
                        <i className="fa-regular fa-file-lines mr-2"></i>
                        {uploadingResume ? 'Uploading…' : 'Resume'}
                      </button>
                      {localLead?.resume_url && (
                        <a
                          href={localLead.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                          onClick={(e) => e.stopPropagation()}
                          title="View current resume"
                        >
                          View
                        </a>
                      )}
                    </div>
                  )}
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center whitespace-nowrap shrink-0"
                    onClick={handleConvertToClient}
                  >
                    <i className="fa-solid fa-building mr-2"></i>
                    Convert to Client
                  </button>
                  {entityType !== 'candidate' && (
                    <button
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center whitespace-nowrap shrink-0"
                      onClick={handleConvertToCandidate}
                      disabled={isConverting}
                    >
                      <i className="fa-solid fa-user-plus mr-2"></i>
                      {isConverting ? 'Converting...' : 'Convert to Candidate'}
                    </button>
                  )}
                  <button
                    className={`px-4 py-2 rounded-lg flex items-center whitespace-nowrap shrink-0 ${
                      (!getLinkedInUrl(localLead) || dailyLinkedInCount >= 20) 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-linkedin hover:bg-blue-700'
                    } text-white`}
                    onClick={handleLinkedInRequestClick}
                    disabled={!getLinkedInUrl(localLead) || dailyLinkedInCount >= 20}
                    style={{backgroundColor: (!getLinkedInUrl(localLead) || dailyLinkedInCount >= 20) ? undefined : '#0077B5'}}
                    title={
                      !getLinkedInUrl(localLead) ? 'No LinkedIn URL available' : 
                      dailyLinkedInCount >= 20 ? 'Daily LinkedIn request limit reached (20/20)' :
                      shouldShowComingSoon() ? 'LinkedIn requests coming soon for your role!' :
                      `Send LinkedIn connection request (${dailyLinkedInCount}/20 used today)`
                    }
                  >
                    <i className="fa-brands fa-linkedin mr-2"></i>
                    LinkedIn Request {dailyLinkedInCount >= 20 && '(Limit Reached)'}
                  </button>
                  {false && entityType !== 'candidate' && (() => {
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
                      tooltipText = 'Find contact information using multiple enrichment services';
                      flowText = '';
                    } else {
                      buttonClass = 'bg-green-50 border border-green-500 text-green-700 hover:bg-green-100';
                      buttonText = 'Re-enrich';
                      tooltipText = 'Re-run enrichment to find additional data or update existing information';
                      flowText = '';
                    }
                    
                    return (
                      <button
                        className={`px-4 py-2 rounded-lg flex items-center whitespace-nowrap shrink-0 disabled:opacity-50 ${buttonClass}`}
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
                        {flowText && (
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
                            <span className="ml-1">Decodo → Hunter.io → Skrapp.io → Apollo (with graceful fallbacks)</span>
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
                      {enrichmentStatusSummary?.success && (
                        <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${enrichmentSourceChipColor(enrichmentStatusSummary.source)}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                            {formatEnrichmentSourceLabel(enrichmentStatusSummary.source)}
                          </span>
                        </div>
                      )}
                      
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
                                  onClick={() => {/* TODO: Trigger PhantomBuster re-run */}}
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
                {/* Apollo Functions & Departments */}
                {(() => {
                  const functionsAndDepts = getApolloFunctionsAndDepartments(localLead);
                  return functionsAndDepts.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center">
                        Functions & Departments
                        <span className="ml-2 text-xs text-purple-600 flex items-center">
                          <span className="mr-1">🚀</span>
                          via Apollo
                        </span>
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {functionsAndDepts.map((item, idx) => (
                          <span 
                            key={idx} 
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              item.type === 'department' ? 'bg-blue-100 text-blue-800' :
                              item.type === 'subdepartment' ? 'bg-green-100 text-green-800' :
                              'bg-orange-100 text-orange-800'
                            }`}
                            title={`${item.type}: ${item.value}`}
                          >
                            {item.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
                
                {/* Apollo Social Profiles */}
                {(() => {
                  const socialProfiles = getApolloSocialProfiles(localLead);
                  return socialProfiles.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center">
                        Social Profiles
                        <span className="ml-2 text-xs text-purple-600 flex items-center">
                          <span className="mr-1">🚀</span>
                          via Apollo
                        </span>
                      </h3>
                      <div className="space-y-2">
                        {socialProfiles.map((profile, idx) => (
                          <div key={idx} className="flex items-center space-x-3">
                            <i className={`${profile.icon} text-gray-500`}></i>
                            <a 
                              href={profile.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-600 hover:underline flex-1"
                            >
                              {profile.url.replace(/^https?:\/\//, "")}
                            </a>
                            <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                              Apollo
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
                
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
                            const emailInfo = getEmailWithSource(getCurrentLocal());
                            const errorContext = getEnrichmentErrorContext(getCurrentLocal());
                            
                            // Also check for Apollo additional emails
                            const apolloEmails = [];
                            const enrichmentData = getCurrentLocal().enrichment_data || {};
                            if (enrichmentData.apollo?.personal_emails && Array.isArray(enrichmentData.apollo.personal_emails)) {
                              enrichmentData.apollo.personal_emails.forEach(email => {
                                if (email && email !== emailInfo?.email) {
                                  apolloEmails.push({ type: 'Personal', email });
                                }
                              });
                            }
                            
                            return emailInfo ? (
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="flex-1" title={emailInfo.tooltip}>
                                    {emailInfo.email}
                                  </span>
                                  <span 
                                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                                      emailInfo.source === 'Hunter.io' ? 'bg-green-100 text-green-700' :
                                      emailInfo.source === 'Skrapp.io' ? 'bg-blue-100 text-blue-700' :
                                      emailInfo.source === 'Apollo' ? 'bg-purple-100 text-purple-700' :
                                      emailInfo.source === 'Decodo' ? 'bg-indigo-100 text-indigo-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}
                                    title={`Email source: ${emailInfo.source}${emailInfo.enrichedAt ? ` (${new Date(emailInfo.enrichedAt).toLocaleDateString()})` : ''}`}
                                  >
                                    {emailInfo.source}
                                  </span>
                                </div>
                                {apolloEmails.length > 0 && (
                                  <div className="mt-1 space-y-1">
                                    {apolloEmails.map((email, idx) => (
                                      <div key={idx} className="flex items-center space-x-2 text-sm">
                                        <span className="text-gray-500 w-12 text-xs">{email.type}:</span>
                                        <span className="flex-1 text-gray-600">{email.email}</span>
                                        <span className="text-xs px-1 py-0.5 rounded bg-purple-50 text-purple-600">Apollo</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
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
                          {entityType === 'candidate' && (
                            <button
                              onClick={reEnrichCandidate}
                              className="px-2 py-1 text-gray-500 hover:text-purple-600 text-sm"
                              title="Re-enrich candidate data"
                            >
                              <i className="fa-solid fa-wand-magic-sparkles"></i>
                            </button>
                          )}
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
                            const phoneInfo = getPhoneWithSource(getCurrentLocal());
                            const errorContext = getEnrichmentErrorContext(getCurrentLocal());
                            
                            // Apollo doesn't seem to provide additional phone numbers in this data structure
                            const apolloPhones = [];
                            const enrichmentData = getCurrentLocal().enrichment_data || {};
                            // Note: Apollo data structure doesn't include separate mobile/work phones
                            // Only the main phone number is provided in the primary phone field
                            
                            return phoneInfo ? (
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
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
                                {apolloPhones.length > 0 && (
                                  <div className="mt-1 space-y-1">
                                    {apolloPhones.map((phone, idx) => (
                                      <div key={idx} className="flex items-center space-x-2 text-sm">
                                        <span className="text-gray-500 w-12 text-xs">{phone.type}:</span>
                                        <span className="flex-1 text-gray-600">{phone.number}</span>
                                        <span className="text-xs px-1 py-0.5 rounded bg-purple-50 text-purple-600">Apollo</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
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

                {/* Activity Log Section */}
                <ActivityLogSection 
                  lead={getCurrentLocal()} 
                  entityType={entityType}
                  onActivityAdded={(activity) => {
                    // Optionally refresh lead data or update UI
                    // Activity added successfully
                  }}
                />

                {/* Sequence Enrollment Section */}
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">Sequence Enrollment</h3>
                    <button className="text-sm text-gray-500 hover:text-gray-700" onClick={()=>fetchSequenceEnrollment(localLead.id)} disabled={loadingEnrollment}>Refresh</button>
                  </div>
                  {loadingEnrollment ? (
                    <div className="text-sm text-gray-500">Loading...</div>
                  ) : !enrollment ? (
                    <div className="text-sm text-gray-500">Not enrolled. Enroll from Leads list or Sequences tab.</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium">Status:</span> <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">{enrollment.status}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Current step:</span> {enrollment.current_step_order}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Next ETA:</span> {(() => {
                          const next = (enrollmentRuns || []).find(r=>r.status==='pending');
                          return next ? new Date(next.send_at).toLocaleString() : '—';
                        })()}
                      </div>
                      <div className="flex gap-2 mt-2">
                        {enrollment.status === 'active' && (
                          <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={async()=>{
                            const { data:{session} } = await supabase.auth.getSession();
                            const token = session?.access_token;
                            await fetch(`${API_BASE_URL}/enrollments/${enrollment.id}/pause`, { method:'POST', headers:{ ...(token?{Authorization:`Bearer ${token}`}:{}) }, credentials:'include' });
                            fetchSequenceEnrollment(localLead.id);
                          }}>Pause</button>
                        )}
                        {enrollment.status === 'paused' && (
                          <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={async()=>{
                            const { data:{session} } = await supabase.auth.getSession();
                            const token = session?.access_token;
                            await fetch(`${API_BASE_URL}/enrollments/${enrollment.id}/resume`, { method:'POST', headers:{ ...(token?{Authorization:`Bearer ${token}`}:{}) }, credentials:'include' });
                            fetchSequenceEnrollment(localLead.id);
                          }}>Resume</button>
                        )}
                        {['active','paused'].includes(enrollment.status) && (
                          <button className="px-3 py-1 border rounded hover:bg-red-50 text-red-600 border-red-300" onClick={async()=>{
                            const { data:{session} } = await supabase.auth.getSession();
                            const token = session?.access_token;
                            await fetch(`${API_BASE_URL}/enrollments/${enrollment.id}/cancel`, { method:'POST', headers:{ ...(token?{Authorization:`Bearer ${token}`}:{}) }, credentials:'include' });
                            fetchSequenceEnrollment(localLead.id);
                          }}>Cancel</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Enhanced Insights CTA: always visible below Work History header */}
                <div className="mt-4">
                  {!enhancedUnlocked ? (
                    <div className="p-3 border rounded-lg bg-amber-900/20 border-amber-500/30 flex items-center justify-between">
                      <div className="text-sm text-amber-200">
                        Unlock Enhanced Company Insights (revenue, funding, technologies, keywords)
                      </div>
                      <button
                        className="ml-3 inline-flex items-center px-3 py-1.5 rounded text-sm bg-amber-500 hover:bg-amber-400 text-black font-medium shadow border border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60"
                        onClick={handleUnlockEnhancedInsights}
                        disabled={isUnlockingInsights}
                      >
                        {isUnlockingInsights ? 'Unlocking…' : '🔓 Unlock Enhanced Insights (+1 credit)'}
                      </button>
                    </div>
                  ) : !enhancedDataAvailable ? (
                    <div className="p-3 border rounded-lg bg-gray-50 text-gray-600 text-sm">
                      Enhanced insights are unlocked, but we didn’t find company-level details yet. Try re-enriching once more.
                    </div>
                  ) : null}
                </div>

                {/* Blur the rest if not enriched */}
                <div className={isEnriched ? '' : 'relative pointer-events-none select-none'}>
                  <div className={isEnriched ? '' : 'blur-sm'}>
                    {/* Work History */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Work History</h3>
                        {isEnriched && localLead.enrichment_data?.apollo?.employment_history?.length > 0 && (
                          <span className="text-xs text-purple-600 flex items-center">
                            <span className="mr-1">🚀</span>
                            via Apollo
                          </span>
                        )}
                      </div>
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
                    {/* Enhanced Company Insights (data view) */}
                    {enhancedUnlocked && enhancedDataAvailable && enhancedCompany && (
                      <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
                              Enhanced Company Insights
                            </p>
                            <p className="mt-0.5 text-xs text-gray-300">
                              Revenue, funding, technologies, and more – powered by{' '}
                              <span className="font-medium">
                                {enhancedProvider === 'skrapp' ? 'Skrapp' : enhancedProvider === 'apollo' ? 'Apollo' : 'our enrichment'}
                              </span>
                            </p>
                          </div>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            Unlocked
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-200">
                          {enhancedCompany?.revenue_range && (
                            <div>
                              <p className="text-[10px] uppercase text-gray-400">Revenue</p>
                              <p>{enhancedCompany.revenue_range}</p>
                            </div>
                          )}
                          {(enhancedCompany?.employee_range || enhancedCompany?.employee_count) && (
                            <div>
                              <p className="text-[10px] uppercase text-gray-400">Employees</p>
                              <p>{enhancedCompany.employee_range || enhancedCompany.employee_count}</p>
                            </div>
                          )}
                          {enhancedCompany?.industry && (
                            <div>
                              <p className="text-[10px] uppercase text-gray-400">Industry</p>
                              <p>{enhancedCompany.industry}</p>
                            </div>
                          )}
                          {enhancedCompany?.headquarters && (
                            <div>
                              <p className="text-[10px] uppercase text-gray-400">HQ</p>
                              <p>{enhancedCompany.headquarters}</p>
                            </div>
                          )}
                          {enhancedCompany?.funding_total && (
                            <div>
                              <p className="text-[10px] uppercase text-gray-400">Funding</p>
                              <p>{enhancedCompany.funding_total}</p>
                            </div>
                          )}
                          {enhancedCompany?.last_funding_round && (
                            <div>
                              <p className="text-[10px] uppercase text-gray-400">Latest Round</p>
                              <p>{enhancedCompany.last_funding_round}</p>
                            </div>
                          )}
                        </div>
                        {(enhancedCompany?.technologies?.length || enhancedCompany?.keywords?.length) && (
                          <div className="mt-3">
                            {Array.isArray(enhancedCompany?.technologies) && enhancedCompany.technologies.length > 0 && (
                              <>
                                <p className="text-[10px] uppercase text-gray-400 mb-1">Tech stack</p>
                                <div className="flex flex-wrap gap-1">
                                  {enhancedCompany.technologies.map((tech) => (
                                    <button
                                      key={tech}
                                      onClick={() => openRexWithFilter('tech', tech)}
                                      className="rounded-full bg-gray-900/70 px-2 py-[2px] text-[10px] text-gray-200 hover:bg-gray-800"
                                    >
                                      {tech}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                            {Array.isArray(enhancedCompany?.keywords) && enhancedCompany.keywords.length > 0 && (
                              <>
                                <p className="mt-2 text-[10px] uppercase text-gray-400 mb-1">Keywords</p>
                                <div className="flex flex-wrap gap-1">
                                  {enhancedCompany.keywords.map((kw) => (
                                    <button
                                      key={kw}
                                      onClick={() => openRexWithFilter('keyword', kw)}
                                      className="rounded-full bg-gray-900/70 px-2 py-[2px] text-[10px] text-gray-200 hover:bg-gray-800"
                                    >
                                      {kw}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Skills */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Skills & Keywords</h3>
                        {isEnriched && getSkills(localLead).length > 0 && localLead.enrichment_data?.apollo && (
                          <span className="text-xs text-purple-600 flex items-center">
                            <span className="mr-1">🚀</span>
                            via Apollo
                          </span>
                        )}
                      </div>
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
                                  onClick={() => {/* TODO: Trigger PhantomBuster run */}}
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

      {showEditModal && (
        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          entityType={entityType === 'candidate' ? 'candidate' : 'lead'}
          entity={entityType === 'candidate' ? localCandidate : localLead}
          onSaved={(updated)=>{
            if (entityType === 'candidate') {
              setLocalCandidate(prev => ({ ...prev, ...updated }));
            } else {
              setLocalLead(prev => ({ ...prev, ...updated }));
            }
            onLeadUpdated && onLeadUpdated(updated);
          }}
        />
      )}

      {/* Credit Confirmation Modal */}
      {showCreditConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-xl p-6 w-full max-w-md shadow-lg border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-gray-100">
              <i className="fa-solid fa-coins text-yellow-500 mr-2"></i>
              Confirm LinkedIn Request
            </h3>
            
            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You're about to send a LinkedIn connection request to <strong>{localLead.name}</strong>.
              </p>
              
              {/* Credit breakdown */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Current Balance:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{userCredits} credits</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Request Cost:</span>
                  <span className="font-semibold text-red-600">-10 credits</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">After Request:</span>
                  <span className={`font-bold ${userCredits >= 10 ? 'text-green-600' : 'text-red-600'}`}>
                    {userCredits - 10} credits
                  </span>
                </div>
              </div>

              {userCredits < 10 && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
                  <div className="flex items-center">
                    <i className="fa-solid fa-exclamation-triangle text-red-500 mr-2"></i>
                    <span className="text-sm text-red-700 dark:text-red-300 font-medium">
                      Insufficient credits to send this request (need 10 credits)
                    </span>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p>💡 Credits are charged when the request is successfully sent via LinkedIn</p>
                <p className="mt-1">🤖 Automation will complete within 30-60 seconds via n8n</p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreditConfirm(false);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
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
                disabled={userCredits < 10}
              >
                <i className="fa-brands fa-linkedin mr-2"></i>
                {userCredits < 10 ? 'Insufficient Credits (Need 10)' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn Request Modal */}
      {showLinkedInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-xl p-6 w-full max-w-lg shadow-lg border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Send LinkedIn Request</h3>
            <p className="mb-4 text-gray-600 dark:text-gray-300 text-sm">
              Send a connection request to <strong>{localLead.name}</strong> on LinkedIn.
            </p>
            
            {/* Automation Info */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                🤖 Automated LinkedIn Connection
              </label>
              <div className="flex gap-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="rexMode"
                    value="manual"
                    checked={rexMode === 'manual'}
                    onChange={(e) => setRexMode(e.target.value)}
                    className="mr-2 text-purple-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    <strong>Manual</strong> - Review message before sending
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="rexMode"
                    value="auto"
                    checked={rexMode === 'auto'}
                    onChange={(e) => setRexMode(e.target.value)}
                    className="mr-2 text-purple-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    <strong>Auto</strong> - Send immediately
                  </span>
                </label>
              </div>
            </div>
            
            {/* Daily limit indicator */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Daily LinkedIn Requests
                </span>
                <span
                  className={`text-sm font-bold ${
                    dailyLinkedInCount >= 19
                      ? 'text-yellow-600 dark:text-yellow-300'
                      : 'text-blue-600 dark:text-blue-300'
                  }`}
                >
                  {dailyLinkedInCount}/20
                </span>
              </div>
              <div className="mt-2 w-full bg-blue-200 dark:bg-blue-900/40 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    dailyLinkedInCount >= 19 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${(dailyLinkedInCount / 20) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Personal message (or select template)
                </label>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {linkedInMessage.length}/300
                </div>
              </div>
              {/* Template selector */}
              <div className="mb-2 flex items-center gap-2">
                <select
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  value={selectedLiTemplateId}
                  onChange={(e) => setSelectedLiTemplateId(e.target.value)}
                >
                  <option value="">-- Select LinkedIn template (optional) --</option>
                  {liTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                  onClick={() => {
                    const tpl = liTemplates.find(t => t.id === selectedLiTemplateId);
                    const base = (tpl?.content || '').trim();
                    const tokenData = {
                      Candidate: {
                        FirstName: (getDisplayName(localLead)||'').split(' ')[0] || (localLead?.first_name||'') || '',
                        LastName: (getDisplayName(localLead)||'').split(' ').slice(1).join(' ') || (localLead?.last_name||'') || '',
                        Company: localLead?.company || '',
                        Job: localLead?.title || '',
                        Email: localLead?.email || ''
                      },
                      first_name: (localLead?.first_name||'') || (getDisplayName(localLead)||'').split(' ')[0] || '',
                      last_name: (localLead?.last_name||'') || (getDisplayName(localLead)||'').split(' ').slice(1).join(' ') || '',
                      company: localLead?.company || '',
                      title: localLead?.title || ''
                    };
                    const preview = replaceTokens(base, tokenData).slice(0,300);
                    setLinkedInMessage(preview);
                  }}
                  disabled={!selectedLiTemplateId}
                  title="Preview how this template will personalize for this contact"
                >
                  Preview
                </button>
              </div>
              {/* Preview and apply template */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Tokens: {"{{first_name}}"}, {"{{last_name}}"}, {"{{company}}"}, {"{{title}}"}</span>
              </div>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="Add a personal message to your connection request..."
                maxLength={300}
                rows={4}
                value={linkedInMessage}
                onChange={(e) => setLinkedInMessage(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Tip: Use tokens like {"{{first_name}}"}, {"{{company}}"}, {"{{title}}"}. Max 300 chars.
              </p>
            </div>
            
            {/* Consent Checkbox */}
            <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mr-3 mt-1 text-orange-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  <strong>I consent to HirePilot acting on my behalf to automate LinkedIn outreach.</strong> 
                  I understand this simulates my own manual usage.
                </span>
              </label>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowLinkedInModal(false);
                  setLinkedInMessage('');
                  setConsentAccepted(false);
                  setShowCreditConfirm(false);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                disabled={isSubmittingLinkedIn}
              >
                Cancel
              </button>
              <button
                onClick={handleLinkedInSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                style={{backgroundColor: '#0077B5'}}
                disabled={isSubmittingLinkedIn || !consentAccepted || userCredits < 10}
              >
                {isSubmittingLinkedIn ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    Starting Automation...
                  </>
                ) : (
                  <>
                    <i className="fa-brands fa-linkedin mr-2"></i>
                    Send LinkedIn Connect
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Modal disabled */}
      {false && showComingSoonModal && (
        <div />
      )}

      {showMetadata && (
        <MetadataModal
          isOpen={showMetadata}
          onClose={() => setShowMetadata(false)}
          entity="lead"
          leadId={localLead?.id}
        />
      )}
    </div>
  );
}

// Temporary alias to fix "CandidateProfileDrawer is not defined" error
// This allows any phantom references to resolve to the correct component
export { LeadProfileDrawer as CandidateProfileDrawer };
