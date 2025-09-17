import React, { useState, useEffect, useRef } from 'react';
import { usePlan } from '../context/PlanContext';
import LeadsTableSkeleton from '../components/leads/LeadsTableSkeleton';
import { useSearchParams } from 'react-router-dom';
import LeadProfileDrawer from './LeadProfileDrawer';
import { getLeads } from '../services/leadsService';
import { FaPlus, FaFileExport, FaEllipsisV, FaSearch, FaEdit, FaEnvelope, FaUserPlus, FaTrash, FaTimes, FaCheck, FaExclamationTriangle, FaLink as FaLinkIcon } from 'react-icons/fa';
import { FaWandMagicSparkles, FaGoogle, FaMicrosoft, FaCircle } from 'react-icons/fa6';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import CsvImportButton from '../components/leads/CsvImportButton';
import AttachToCampaignModal from '../components/AttachToCampaignModal';
import { supabase } from '../lib/supabaseClient';
import { downloadCSV } from '../utils/csvExport';
import { FaInbox, FaPaperPlane, FaFile, FaStar, FaTrash as FaTrashAlt, FaPenToSquare, FaFileLines, FaFilter, FaSort, FaAddressBook, FaBold, FaItalic, FaUnderline, FaListUl, FaListOl, FaLink, FaPaperclip, FaPuzzlePiece, FaChevronDown, FaClock, FaRegStar, FaRegBell } from 'react-icons/fa6';
import { replaceTokens } from '../utils/tokenReplace';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useCampaignOptions } from '../hooks/useCampaignOptions';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

// Helper function to generate avatar URL
const getAvatarUrl = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

function LeadManagement() {
  const { isFree } = usePlan();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [selectedCampaignName, setSelectedCampaignName] = useState('');
  const [selectedTags, setSelectedTags] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { options: campaignOptions, loading: campaignsLoading, error: campaignsError } = useCampaignOptions();
  const [showActionsMenu, setShowActionsMenu] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [editedLead, setEditedLead] = useState(null);
  const [messageContent, setMessageContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [isEnriching, setIsEnriching] = useState(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);
  const [showBulkMessageModal, setShowBulkMessageModal] = useState(false);
  const [bulkTemplates, setBulkTemplates] = useState([]);
  const [bulkSelectedTemplate, setBulkSelectedTemplate] = useState(null);
  const [showSequencePicker, setShowSequencePicker] = useState(false);
  const [sequences, setSequences] = useState([]);
  const [selectedSequenceId, setSelectedSequenceId] = useState('');
  const [sequenceStart, setSequenceStart] = useState(new Date());
  const [sequenceTz, setSequenceTz] = useState('America/Chicago');
  const [bulkMessages, setBulkMessages] = useState({});
  const [bulkIsSending, setBulkIsSending] = useState(false);
  const [bulkIsSavingTemplate, setBulkIsSavingTemplate] = useState(false);
  const [bulkPreviewModes, setBulkPreviewModes] = useState({});
  const tagInputRefs = useRef({});
  const [tagEditLeadId, setTagEditLeadId] = useState(null);
  const [tagInputValue, setTagInputValue] = useState('');
  const [showBulkConvertDialog, setShowBulkConvertDialog] = useState(false);
  const [isBulkConverting, setIsBulkConverting] = useState(false);
  const [showBulkExportDialog, setShowBulkExportDialog] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [addLeadForm, setAddLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    company: '',
    linkedin_url: '',
    status: 'New',
    tags: '',
    location: '',
    campaign: '',
  });
  const [addLeadErrors, setAddLeadErrors] = useState({});
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const LEADS_PER_PAGE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const [showSelectMenu, setShowSelectMenu] = useState(false);
  const [isLeadsLoading, setIsLeadsLoading] = useState(true);

  // Bulk tagging state
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [isBulkTagging, setIsBulkTagging] = useState(false);

  // Provider selection for bulk messaging
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerStatus, setProviderStatus] = useState({
    google: false,
    outlook: false,
    sendgrid: false,
    apollo: false
  });

  // Scheduling state for bulk messaging
  const [showBulkSchedule, setShowBulkSchedule] = useState(false);
  const [bulkScheduledDate, setBulkScheduledDate] = useState(null);

  // Attach to Campaign modal state
  const [showAttachToCampaignModal, setShowAttachToCampaignModal] = useState(false);
  const [attachLeadIds, setAttachLeadIds] = useState([]);

  // Provider selection for sequence enrollment
  const [sequenceProvider, setSequenceProvider] = useState(null); // 'google' | 'outlook' | 'sendgrid'

  // Load leads function with campaign filtering support
  const loadLeads = async (campaignId = selectedCampaign) => {
    try {
      setIsLeadsLoading(true);
      // Use the backend API for all cases (with or without campaign filtering)
      const rawLeads = await getLeads(campaignId);

      const mapped = rawLeads.map((lead) => {
        const enrichment =
          typeof lead.enrichment_data === 'string'
            ? (() => { try { return JSON.parse(lead.enrichment_data); } catch { return {}; } })()
            : lead.enrichment_data || {};

        // Prefer stable DB columns first, then enrichment fallbacks
        const computedLocation = [lead.city, lead.state, lead.country]
          .filter(Boolean)
          .join(', ')
          || lead.campaign_location
          || lead.location
          || enrichment.location
          || 'Unknown';

        const normalizeSource = (val) => {
          if (!val) return null;
          const v = String(val).trim().toLowerCase();
          if (v === 'apollo') return 'Apollo';
          if (v === 'sales navigator' || v === 'sales_navigator' || v === 'phantombuster' || v === 'phantom') return 'Sales Navigator';
          if (v === 'chrome extension') return 'Chrome Extension';
          return val; // keep original case if already human-readable
        };

        const computedSource = normalizeSource(lead.enrichment_source)
          || normalizeSource(lead.source)
          || normalizeSource(enrichment.source)
          || 'Unknown';

        return {
          id: lead.id,
          name: lead.name,
          title: lead.title,
          company: lead.company,
          email: lead.email,
          linkedin_url: lead.linkedin_url,
          enrichment,
          status: lead.status,
          createdAt: lead.created_at,
          updatedAt: lead.updated_at,
          avatar: getAvatarUrl(lead.name),
          tags: lead.tags || [],
          campaign: lead.campaign,
          campaign_id: lead.campaign_id,
          phone: lead.phone,
          source: computedSource,
          location: computedLocation,
          workHistory: enrichment.workHistory || [],
          gptNotes: enrichment.gptNotes || '',
          skills: [],
          twitter: '',
          outreachHistory: [],
        };
      });
      setLeads(mapped);
    } catch (error) {
      console.error('Failed to load leads', error);
    }
    finally {
      setIsLeadsLoading(false);
    }
  };

  // Initialize state from URL params on mount
  useEffect(() => {
    const campaignId = searchParams.get('campaignId');
    const campaignName = searchParams.get('campaignName');
    
    if (campaignId && campaignId !== 'all') {
      setSelectedCampaign(campaignId);
      if (campaignName) {
        setSelectedCampaignName(decodeURIComponent(campaignName));
      }
    } else {
      setSelectedCampaign('all');
      setSelectedCampaignName('');
    }
  }, [searchParams]);

  // Load leads when campaign selection changes
  useEffect(() => {
    loadLeads(selectedCampaign);
  }, [selectedCampaign]);

  // Validate campaign ID after campaign options load
  useEffect(() => {
    if (!campaignsLoading && campaignOptions.length > 0 && selectedCampaign !== 'all') {
      const isValidCampaign = campaignOptions.some(c => c.id === selectedCampaign);
      if (!isValidCampaign) {
        // Campaign ID is invalid or inaccessible, fall back to "All Campaigns"
        console.warn('Invalid or inaccessible campaign ID, falling back to All Campaigns');
        handleCampaignChange('all');
      }
    }
  }, [campaignsLoading, campaignOptions, selectedCampaign]);

  // Handle campaign filter change
  const handleCampaignChange = (campaignId) => {
    setSelectedCampaign(campaignId);
    
    // Update URL params
    const newSearchParams = new URLSearchParams(searchParams);
    
    if (campaignId === 'all') {
      // Remove campaign params for "All Campaigns"
      newSearchParams.delete('campaignId');
      newSearchParams.delete('campaignName');
      setSelectedCampaignName('');
    } else {
      // Set campaign params for specific campaign
      const campaign = campaignOptions.find(c => c.id === campaignId);
      newSearchParams.set('campaignId', campaignId);
      if (campaign?.name) {
        newSearchParams.set('campaignName', encodeURIComponent(campaign.name));
        setSelectedCampaignName(campaign.name);
      }
    }
    
    // Update URL (replace, not push, to avoid adding to history)
    setSearchParams(newSearchParams, { replace: true });
  };

  const handleLeadClick = (lead, event) => {
    if (event.target.closest('.actions-menu')) {
      return;
    }
    setSelectedLead(lead);
    setShowDrawer(true);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleActionsClick = (e, leadId) => {
    e.stopPropagation();
    setShowActionsMenu(showActionsMenu === leadId ? null : leadId);
  };

  const handleAction = (action, lead, e) => {
    e.stopPropagation();
    setShowActionsMenu(null);
    switch (action) {
      case 'edit':
        setEditedLead({ ...lead });
        setShowEditModal(true);
        break;
      case 'message':
        setSelectedLead(lead);
        setShowMessageModal(true);
        break;
      case 'convert':
        setSelectedLead(lead);
        setShowConvertModal(true);
        break;
      case 'delete':
        setLeadToDelete(lead);
        setShowConfirmDialog(true);
        break;
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await fetch(`${API_BASE_URL}/leads/${leadToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete lead' }));
        throw new Error(errorData.message || 'Failed to delete lead');
      }

      setLeads(leads.filter(lead => lead.id !== leadToDelete.id));
      setShowConfirmDialog(false);
      setLeadToDelete(null);
      toast.success('Lead deleted successfully');
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error(error.message || 'Failed to delete lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm(editedLead);
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Please fix the form errors');
      return;
    }

    try {
      setIsSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await fetch(`${API_BASE_URL}/leads/${editedLead.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(editedLead),
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 409) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || 'A lead with this email already exists.');
        }
        const errorData = await response.json().catch(() => ({ message: 'Failed to update lead' }));
        throw new Error(errorData.message || 'Failed to update lead');
      }

      const updatedLead = await response.json();
      setLeads(leads.map(lead => 
        lead.id === updatedLead.id ? updatedLead : lead
      ));
      setShowEditModal(false);
      setEditedLead(null);
      setFormErrors({});
      toast.success('Lead updated successfully');
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error(error.message || 'Failed to update lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMessageSubmit = async (e) => {
    e.preventDefault();
    if (!messageContent.trim()) {
      toast.error('Message cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/leads/${selectedLead.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: messageContent }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to send message' }));
        throw new Error(errorData.message || 'Failed to send message');
      }

      const { message, lead } = await response.json();
      
      // Update the lead in the local state
      setLeads(leads.map(l => 
        l.id === lead.id ? { ...l, status: lead.status } : l
      ));

      setShowMessageModal(false);
      setMessageContent('');
      toast.success('Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const accessToken = session.access_token;
      const response = await fetch(`${API_BASE_URL}/leads/${selectedLead.id}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: session.user.id }),
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to convert lead' }));
        throw new Error(errorData.message || 'Failed to convert lead');
      }
      const { candidate } = await response.json();
      setLeads(leads.filter(lead => lead.id !== selectedLead.id));
      setShowConvertModal(false);
      toast.success('Lead converted to candidate successfully');
    } catch (error) {
      console.error('Error converting lead:', error);
      toast.error(error.message || 'Failed to convert lead');
    }
  };

  const handleEnrich = async (leadId) => {
    setIsEnriching(leadId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const accessToken = session.access_token;
      
      const response = await fetch(`${API_BASE_URL}/leads/${leadId}/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to enrich lead' }));
        throw new Error(errorData.message || 'Failed to enrich lead');
      }
      const updated = await response.json();
      setLeads((prevLeads) => prevLeads.map((l) => l.id === leadId ? { ...l, ...updated.data } : l));
      toast.success('Lead enriched successfully!');
    } catch (error) {
      console.error('Error enriching lead:', error);
      toast.error(error.message || 'Failed to enrich lead');
    } finally {
      setIsEnriching(null);
    }
  };

  const handleBulkEnrich = async () => {
    setIsBulkEnriching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const accessToken = session.access_token;
      
      const enrichPromises = selectedLeadIds.map(leadId =>
        fetch(`${API_BASE_URL}/leads/${leadId}/enrich`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          credentials: 'include',
        })
          .then(async response => {
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Failed to enrich lead' }));
              throw new Error(errorData.message || 'Failed to enrich lead');
            }
            return response.json();
          })
          .then(updated => {
            setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, ...updated.data } : l));
            toast.success(`Lead ${leadId} enriched successfully!`);
          })
          .catch(error => {
            toast.error(`Lead ${leadId}: ${error.message || 'Failed to enrich lead'}`);
          })
      );
      await Promise.all(enrichPromises);
    } finally {
      setIsBulkEnriching(false);
    }
  };

  // Add this new function to get unique tags from all leads
  const getAllUniqueTags = () => {
    const tagSet = new Set();
    leads.forEach(lead => {
      (lead.tags || []).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  };

  // Filter leads by search, status, and tags (campaign filtering is done at database level)
  const filteredLeads = leads.filter(lead => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      (lead.name?.toLowerCase() || '').includes(searchLower) ||
      (lead.title?.toLowerCase() || '').includes(searchLower) ||
      (lead.email?.toLowerCase() || '').includes(searchLower) ||
      (lead.location?.toLowerCase() || '').includes(searchLower) ||
      (lead.tags || []).some(tag => (tag?.toLowerCase() || '').includes(searchLower))
    );

    const matchesStatus = selectedStatus === 'all' || lead.status?.toLowerCase() === selectedStatus.toLowerCase();
    const matchesTags = selectedTags === 'all' || (lead.tags || []).includes(selectedTags);

    return matchesSearch && matchesStatus && matchesTags;
  });

  // Sorting -------------------------------------------------------------
  const [sortBy, setSortBy] = useState('lastUpdated'); // lead | contact | status | tags | location | source | lastUpdated
  const [sortDir, setSortDir] = useState('desc'); // asc | desc

  const valueForSort = (lead, field) => {
    switch (field) {
      case 'lead':
        return (lead.name || '').toLowerCase();
      case 'contact':
        return (lead.email || '').toLowerCase();
      case 'status':
        return (lead.status || '').toLowerCase();
      case 'tags':
        return Array.isArray(lead.tags) ? lead.tags.join(', ').toLowerCase() : '';
      case 'location':
        return (lead.location || '').toLowerCase();
      case 'source':
        return (lead.source || '').toLowerCase();
      case 'lastUpdated':
        return new Date(lead.updatedAt || lead.updated_at || lead.created_at || 0).getTime();
      default:
        return '';
    }
  };

  const handleSort = (field) => {
    setSortBy(prev => {
      if (prev === field) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(field === 'lastUpdated' ? 'desc' : 'asc');
      return field;
    });
  };

  const sortIndicator = (field) => {
    if (sortBy !== field) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const sortedLeads = React.useMemo(() => {
    const arr = [...filteredLeads];
    arr.sort((a, b) => {
      const va = valueForSort(a, sortBy);
      const vb = valueForSort(b, sortBy);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      if (sa < sb) return sortDir === 'asc' ? -1 : 1;
      if (sa > sb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredLeads, sortBy, sortDir]);

  // Form validation
  const validateForm = (lead) => {
    const errors = {};
    
    if (!lead.name?.trim()) {
      errors.name = 'Name is required';
    } else if (lead.name.length < 2 || lead.name.length > 100) {
      errors.name = 'Name must be between 2 and 100 characters';
    }

    if (!lead.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
      errors.email = 'Invalid email format';
    }

    if (lead.phone && !/^\+?[\d\s-()]+$/.test(lead.phone)) {
      errors.phone = 'Invalid phone number format';
    }

    if (lead.title && lead.title.length > 100) {
      errors.title = 'Title must be less than 100 characters';
    }

    if (lead.location && lead.location.length > 100) {
      errors.location = 'Location must be less than 100 characters';
    }

    if (lead.tags) {
      const invalidTags = lead.tags.filter(tag => 
        typeof tag !== 'string' || tag.length < 2 || tag.length > 50
      );
      if (invalidTags.length > 0) {
        errors.tags = 'Each tag must be between 2 and 50 characters';
      }
    }

    return errors;
  };

  // Fetch templates for bulk modal
  const fetchBulkTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', user.id);
    if (!error && data) setBulkTemplates(data);
  };

  // Open bulk message modal
  const handleOpenBulkMessageModal = async () => {
    await fetchBulkTemplates();
    setBulkSelectedTemplate(null);
    setBulkMessages({});
    setShowBulkMessageModal(true);
  };

  const openSequencePicker = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_BASE_URL}/sequences?include_steps=1`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSequences(data || []);
        setShowSequencePicker(true);
        // Initialize provider based on connected status order: google -> outlook -> sendgrid
        if (!sequenceProvider) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: googleData } = await supabase
              .from('google_accounts')
              .select('status')
              .eq('user_id', user.id)
              .maybeSingle();
            const { data: integ } = await supabase
              .from('integrations')
              .select('provider,status')
              .eq('user_id', user.id);
            const connected = new Set((integ||[]).filter(r=>r.status==='connected').map(r=>r.provider));
            if (googleData?.status==='connected') setSequenceProvider('google');
            else if (connected.has('outlook')) setSequenceProvider('outlook');
            else if (connected.has('sendgrid')) setSequenceProvider('sendgrid');
          }
        }
      }
    } catch (e) {
      // ignore
    }
  };

  // Replace tokens in template for a lead
  const personalizeTemplate = (templateContent, lead) => {
    if (!templateContent) return '';
    const data = {
      Candidate: {
        FirstName: lead.name ? lead.name.split(' ')[0] : '',
        LastName: lead.name ? lead.name.split(' ').slice(1).join(' ') : '',
        Company: lead.company || '',
        Job: lead.title || '',
        Email: lead.email || '',
        LinkedIn: lead.linkedin_url || ''
      },
      first_name: lead.first_name || (lead.name ? lead.name.split(' ')[0] : ''),
      last_name: lead.last_name || (lead.name ? lead.name.split(' ').slice(1).join(' ') : ''),
      full_name: lead.name || '',
      company: lead.company || '',
      title: lead.title || '',
      email: lead.email || ''
    };
    return replaceTokens(templateContent, data);
  };

  // Handle template selection in bulk modal
  const handleBulkTemplateSelect = (template) => {
    setBulkSelectedTemplate(template);
    // Pre-fill messages for each selected lead
    const newMessages = {};
    leads.filter(l => selectedLeadIds.includes(l.id)).forEach(lead => {
      newMessages[lead.id] = personalizeTemplate(template.content, lead);
    });
    setBulkMessages(newMessages);
  };

  // Handle message edit for a lead
  const handleBulkMessageEdit = (leadId, value) => {
    setBulkMessages(prev => ({ ...prev, [leadId]: value }));
  };

  // Handle attach to campaign for single lead
  const handleAttachSingleLead = (leadId) => {
    setAttachLeadIds([leadId]);
    setShowAttachToCampaignModal(true);
    setShowActionsMenu(null); // Close the actions menu
  };

  // Handle attach to campaign for multiple leads
  const handleAttachMultipleLeads = () => {
    if (selectedLeadIds.length === 0) return;
    setAttachLeadIds(selectedLeadIds);
    setShowAttachToCampaignModal(true);
  };

  // Handle success after attaching leads to campaign
  const handleAttachSuccess = () => {
    // Refresh the leads to show updated campaign information
    loadLeads(selectedCampaign);
    // Clear selected leads
    setSelectedLeadIds([]);
  };

  // Handle send all
  const handleBulkSend = async () => {
    setBulkIsSending(true);
    try {
      // Send messages to backend (implement your API endpoint as needed)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      if (!selectedProvider) throw new Error('Select a provider first');

      const payload = selectedLeadIds.map(leadId => ({
        lead_id: leadId,
        user_id: user.id,
        content: bulkMessages[leadId],
        template_id: bulkSelectedTemplate?.id || null,
        channel: selectedProvider
      }));

      // Example: send to /api/sendMassMessage
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE_URL}/sendMassMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ messages: payload })
      });
      if (!response.ok) throw new Error('Failed to send messages');
      toast.success('Messages sent!');
      setShowBulkMessageModal(false);
    } catch (err) {
      toast.error(err.message || 'Failed to send messages');
    } finally {
      setBulkIsSending(false);
    }
  };

  // Handle schedule bulk messages
  const handleBulkSchedule = async () => {
    try {
      if (!bulkScheduledDate) {
        toast.error('Please select a date and time');
        return;
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      if (!selectedProvider) throw new Error('Select a provider first');

      const payload = selectedLeadIds.map(leadId => ({
        lead_id: leadId,
        user_id: user.id,
        content: bulkMessages[leadId],
        template_id: bulkSelectedTemplate?.id || null,
        channel: selectedProvider,
        scheduled_for: bulkScheduledDate.toISOString()
      }));

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE_URL}/scheduleMassMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ messages: payload })
      });
      
      if (!response.ok) throw new Error('Failed to schedule messages');
      
      toast.success(`Messages scheduled for ${bulkScheduledDate.toLocaleString()}`);
      setShowBulkSchedule(false);
      setShowBulkMessageModal(false);
      setBulkScheduledDate(null);
    } catch (err) {
      toast.error(err.message || 'Failed to schedule messages');
    }
  };

  // Handle save as template
  const handleBulkSaveTemplate = async () => {
    setBulkIsSavingTemplate(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('email_templates')
        .insert({
          user_id: user.id,
          name: bulkSelectedTemplate?.name + ' (Edited)' || 'Bulk Template',
          subject: bulkSelectedTemplate?.subject || '',
          content: Object.values(bulkMessages)[0] || '',
          created_at: new Date().toISOString()
        });
      if (error) throw error;
      toast.success('Template saved!');
      await fetchBulkTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setBulkIsSavingTemplate(false);
    }
  };

  // Toggle preview/edit for a lead
  const handleTogglePreview = (leadId) => {
    setBulkPreviewModes(prev => ({ ...prev, [leadId]: !prev[leadId] }));
  };

  // Handle tag add
  const handleAddTag = async (leadId) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const newTag = tagInputValue.trim();
    if (!newTag || (lead.tags || []).includes(newTag)) return;
    const newTags = [...(lead.tags || []), newTag];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(`${API_BASE_URL}/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tags: newTags }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to add tag' }));
        throw new Error(errorData.error || 'Failed to add tag');
      }
      
      const updatedLead = await response.json();
      setLeads(leads.map(l => l.id === leadId ? { ...l, tags: newTags } : l));
      setTagInputValue('');
      toast.success('Tag added!');
    } catch (err) {
      toast.error(err.message || 'Failed to add tag');
    }
  };

  // Handle tag remove
  const handleRemoveTag = async (leadId, tag) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const newTags = (lead.tags || []).filter(t => t !== tag);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(`${API_BASE_URL}/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tags: newTags }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to remove tag' }));
        throw new Error(errorData.error || 'Failed to remove tag');
      }
      
      const updatedLead = await response.json();
      setLeads(leads.map(l => l.id === leadId ? { ...l, tags: newTags } : l));
      toast.success('Tag removed!');
    } catch (err) {
      toast.error(err.message || 'Failed to remove tag');
    }
  };

  // Handle tag input key
  const handleTagInputKey = (e, leadId) => {
    if (e.key === 'Enter') {
      handleAddTag(leadId);
    }
  };

  // Bulk convert handler
  const handleBulkConvert = async () => {
    setIsBulkConverting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const accessToken = session.access_token;
      const promises = selectedLeadIds.map(async (leadId) => {
        const response = await fetch(`${API_BASE_URL}/leads/${leadId}/convert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ user_id: session.user.id }),
          credentials: 'include'
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to convert lead' }));
          throw new Error(errorData.message || 'Failed to convert lead');
        }
        return response.json();
      });
      await Promise.all(promises);
      setLeads(leads.filter(l => !selectedLeadIds.includes(l.id)));
      setSelectedLeadIds([]);
      toast.success('Leads converted to candidates!');
      setShowBulkConvertDialog(false);
    } catch (err) {
      toast.error(err.message || 'Failed to convert leads');
    } finally {
      setIsBulkConverting(false);
    }
  };

  // Individual convert handler (reuse handleConvertSubmit, but update status and remove from leads)
  const handleIndividualConvert = async (lead) => {
    if (!window.confirm(`Convert ${lead.name} to candidate? This action cannot be undone.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const accessToken = session.access_token;
      const response = await fetch(`${API_BASE_URL}/leads/${lead.id}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: session.user.id }),
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to convert lead' }));
        throw new Error(errorData.message || 'Failed to convert lead');
      }
      setLeads(leads.filter(l => l.id !== lead.id));
      toast.success(`${lead.name} converted to candidate!`);
    } catch (err) {
      toast.error(err.message || 'Failed to convert lead');
    }
  };

  // Add export handler (gated for Free plan)
  const handleBulkExport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const resp = await fetch(`${API_BASE_URL}/billing/overview`, { headers: { Authorization: `Bearer ${token}` } });
        if (resp.ok) {
          const overview = await resp.json();
          const planTier = (overview?.subscription?.planTier || '').toLowerCase();
          if (planTier === 'free') {
            toast.error('Upgrade to Pro+ to export leads.');
            setShowBulkExportDialog(false);
            return;
          }
        }
      }
    } catch {}
    const selectedLeads = leads.filter(lead => selectedLeadIds.includes(lead.id));
    const exportData = selectedLeads.map(lead => ({
      'Name': lead.name || '',
      'Title': lead.title || '',
      'Company': lead.company || '',
      'Email': lead.email || '',
      'Phone': lead.phone || '',
      'LinkedIn URL': lead.linkedin_url || '',
      'Status': lead.status || '',
      'Tags': (lead.tags || []).join(','),
      'Campaign': lead.campaign || '',
      'Created At': new Date(lead.createdAt).toLocaleDateString(),
      'Last Updated': new Date(lead.updatedAt).toLocaleDateString()
    }));
    downloadCSV(exportData, `leads-export-${new Date().toISOString().split('T')[0]}`);
    setShowBulkExportDialog(false);
  };

  // Add bulk delete handler
  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('User not authenticated');
      const token = session.access_token;

      const res = await fetch(`${API_BASE_URL}/leads`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ids: selectedLeadIds })
      });
      const { deleted = [], notFound = [] } = await res.json();

      setLeads(curr => curr.filter(l => !deleted.includes(l.id)));
      setSelectedLeadIds([]);
      setShowBulkDeleteDialog(false);

      if (deleted.length)
        toast.success(`${deleted.length} lead(s) deleted`);
      if (notFound.length)
        toast.error(`${notFound.length} could not be deleted (already gone?)`);
    } catch (error) {
      console.error('Error deleting leads:', error);
      toast.error(error.message || 'Failed to delete leads');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Add bulk tag handler
  const handleBulkTag = async () => {
    const tagToAdd = bulkTagInput.trim();
    if (!tagToAdd) {
      toast.error('Please enter a tag');
      return;
    }

    setIsBulkTagging(true);
    try {
      const promises = selectedLeadIds.map(async (leadId) => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;

        // Check if tag already exists
        if ((lead.tags || []).includes(tagToAdd)) {
          return { leadId, success: true, message: 'Tag already exists' };
        }

        const newTags = [...(lead.tags || []), tagToAdd];
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        
        const response = await fetch(`${API_BASE_URL}/leads/${leadId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ tags: newTags }),
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to add tag' }));
          throw new Error(errorData.error || 'Failed to add tag');
        }
        
        return { leadId, success: true, newTags };
      });

      const results = await Promise.allSettled(promises);
      let successCount = 0;
      let errorCount = 0;

      results.forEach((result, index) => {
        const leadId = selectedLeadIds[index];
        if (result.status === 'fulfilled' && result.value?.success) {
          successCount++;
          if (result.value.newTags) {
            // Update local state
            setLeads(prevLeads => 
              prevLeads.map(l => 
                l.id === leadId ? { ...l, tags: result.value.newTags } : l
              )
            );
          }
        } else {
          errorCount++;
        }
      });

      if (successCount > 0) {
        toast.success(`Tag "${tagToAdd}" added to ${successCount} lead(s)`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to add tag to ${errorCount} lead(s)`);
      }

      setShowBulkTagModal(false);
      setBulkTagInput('');
    } catch (error) {
      console.error('Error bulk tagging leads:', error);
      toast.error(error.message || 'Failed to add tags');
    } finally {
      setIsBulkTagging(false);
    }
  };

  const paginatedLeads = sortedLeads.slice((currentPage - 1) * LEADS_PER_PAGE, currentPage * LEADS_PER_PAGE);
  const totalPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE);

  // -------------------------------------------------------
  // Provider status helpers (copied from MessagingCenter)
  // -------------------------------------------------------
  const fetchProviderStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Google connection
      const { data: googleData } = await supabase
        .from('google_accounts')
        .select('status')
        .eq('user_id', user.id)
        .single();

      // Other providers
      const { data: otherData } = await supabase
        .from('integrations')
        .select('provider, status')
        .eq('user_id', user.id);

      const status = {
        google: googleData?.status === 'connected',
        outlook: false,
        sendgrid: false,
        apollo: false
      };

      (otherData || []).forEach(row => {
        if (row.status === 'connected') status[row.provider] = true;
      });

      setProviderStatus(status);

      // Auto-select first connected provider if none selected
      if (!selectedProvider) {
        const first = Object.keys(status).find(p => status[p]);
        if (first) setSelectedProvider(first);
      }
    } catch {
      // ignore
    }
  };

  // Reload providers whenever the bulk modal is opened
  useEffect(() => {
    if (showBulkMessageModal) fetchProviderStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBulkMessageModal]);

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Lead Management</h1>
          <div className="flex gap-2">
            <button className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700" onClick={() => setShowAddLeadModal(true)}>
              <FaPlus /> Add Lead
            </button>
            <CsvImportButton onImportComplete={() => window.location.reload()} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[2000px] mx-auto px-6 py-8">
        {isLeadsLoading ? (
          <LeadsTableSkeleton rows={12} />
        ) : (
        <>
        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Search by name, title, email, tags, or location..."
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>
            
            {/* Filters */}
            <div className="flex gap-4">
              <select 
                className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Interested">Interested</option>
                <option value="Not Interested">Not Interested</option>
              </select>
              <select 
                className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                value={selectedCampaign}
                onChange={(e) => handleCampaignChange(e.target.value)}
                disabled={campaignsLoading}
              >
                <option value="all">
                  {campaignsLoading ? 'Loading campaigns...' : 'All Campaigns'}
                </option>
                {!campaignsLoading && campaignOptions.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                    {campaign.status && (
                      <span className="text-gray-500"> ({campaign.status})</span>
                    )}
                  </option>
                ))}
              </select>
              {campaignsError && (
                <p className="mt-1 text-sm text-red-600">
                  Error loading campaigns: {campaignsError}
                </p>
              )}
              <select 
                className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                value={selectedTags}
                onChange={(e) => setSelectedTags(e.target.value)}
              >
                <option value="all">All Tags</option>
                {getAllUniqueTags().map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-4">
          <button
            className={`border px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 ${selectedLeadIds.length < 2 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            disabled={selectedLeadIds.length < 2}
            onClick={selectedLeadIds.length >= 2 ? handleOpenBulkMessageModal : undefined}
          >
            Message
          </button>
          <button
            className={`border px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 ${selectedLeadIds.length === 0 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            disabled={selectedLeadIds.length === 0}
            onClick={selectedLeadIds.length > 0 ? () => setShowBulkTagModal(true) : undefined}
          >
            Tag
          </button>
          <button
            className={`border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-50 text-purple-700 border-purple-500 disabled:opacity-50 ${selectedLeadIds.length === 0 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            disabled={selectedLeadIds.length === 0 || isBulkEnriching}
            onClick={handleBulkEnrich}
          >
            {isBulkEnriching ? (
              <svg className="animate-spin h-4 w-4 mr-1 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
            ) : (
              <FaWandMagicSparkles className="mr-1" />
            )}
            Enrich
          </button>
          <button
            className={`border px-4 py-2 rounded-lg hover:bg-green-50 text-green-700 border-green-500 disabled:opacity-50 ${selectedLeadIds.length < 2 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            disabled={selectedLeadIds.length < 2}
            onClick={() => setShowBulkConvertDialog(true)}
          >
            Convert to Candidate
          </button>
          <button
            className={`border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-50 text-indigo-700 border-indigo-500 disabled:opacity-50 ${selectedLeadIds.length === 0 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            disabled={selectedLeadIds.length === 0}
            onClick={handleAttachMultipleLeads}
          >
            <FaLinkIcon /> Attach to Campaign
          </button>
          {!isFree && (
          <button
            className={`border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-50 text-purple-700 border-purple-500 disabled:opacity-50 ${selectedLeadIds.length === 0 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            disabled={selectedLeadIds.length === 0}
            onClick={openSequencePicker}
          >
            Tiered Template
          </button>
          )}
          <button
            className={`border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-50 text-blue-700 border-blue-500 disabled:opacity-50 ${selectedLeadIds.length < 2 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            disabled={selectedLeadIds.length < 2}
            onClick={() => setShowBulkExportDialog(true)}
          >
            <FaFileExport /> Export
          </button>
          <button
            className={`border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-50 text-red-700 border-red-500 disabled:opacity-50 ${selectedLeadIds.length < 2 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            disabled={selectedLeadIds.length < 2}
            onClick={() => setShowBulkDeleteDialog(true)}
          >
            <FaTrashAlt /> Delete
          </button>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-visible">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="relative inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      checked={selectedLeadIds.length > 0 && selectedLeadIds.length === filteredLeads.length}
                      onChange={e => {
                        if (e.target.checked) {
                          // Default behavior: select all in current filter (existing behavior)
                          setSelectedLeadIds(filteredLeads.map(l => l.id));
                        } else {
                          setSelectedLeadIds([]);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="text-gray-500 hover:text-gray-700 text-xs border border-gray-300 rounded px-2 py-1"
                      onClick={(e) => { e.stopPropagation(); setShowSelectMenu(v => !v); }}
                      title="Selection options"
                    >
                      Select ▾
                    </button>
                    {showSelectMenu && (
                      <div className="absolute z-20 mt-32 left-0 w-64 bg-white border border-gray-200 rounded-md shadow-lg" onMouseLeave={() => setShowSelectMenu(false)}>
                        <div className="py-1 text-sm">
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLeadIds(paginatedLeads.map(l => l.id));
                              setShowSelectMenu(false);
                            }}
                          >
                            Select this page ({paginatedLeads.length})
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLeadIds(filteredLeads.map(l => l.id));
                              setShowSelectMenu(false);
                            }}
                          >
                            Select all in view (filtered) ({filteredLeads.length})
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLeadIds(leads.map(l => l.id));
                              setShowSelectMenu(false);
                            }}
                          >
                            Select all in account ({leads.length})
                          </button>
                          <div className="my-1 border-t border-gray-200" />
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLeadIds([]);
                              setShowSelectMenu(false);
                            }}
                          >
                            Clear selection
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </th>
                <th scope="col" onClick={() => handleSort('lead')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                  <span className="inline-flex items-center">Lead {sortIndicator('lead')}</span>
                </th>
                <th scope="col" onClick={() => handleSort('contact')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                  <span className="inline-flex items-center">Contact {sortIndicator('contact')}</span>
                </th>
                <th scope="col" onClick={() => handleSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                  <span className="inline-flex items-center">Status {sortIndicator('status')}</span>
                </th>
                <th scope="col" onClick={() => handleSort('tags')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                  <span className="inline-flex items-center">Tags {sortIndicator('tags')}</span>
                </th>
                <th scope="col" onClick={() => handleSort('location')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                  <span className="inline-flex items-center">Location {sortIndicator('location')}</span>
                </th>
                <th scope="col" onClick={() => handleSort('source')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                  <span className="inline-flex items-center">Source {sortIndicator('source')}</span>
                </th>
                <th scope="col" onClick={() => handleSort('lastUpdated')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                  <span className="inline-flex items-center">Last Updated {sortIndicator('lastUpdated')}</span>
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedLeads.map((lead) => (
                <tr 
                  key={lead.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={(e) => handleLeadClick(lead, e)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      checked={selectedLeadIds.includes(lead.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedLeadIds([...selectedLeadIds, lead.id]);
                        } else {
                          setSelectedLeadIds(selectedLeadIds.filter(id => id !== lead.id));
                        }
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center min-w-0">
                      <img
                        src={lead.avatar}
                        alt={lead.name}
                        className="h-10 w-10 rounded-full"
                      />
                      <div className="ml-4 min-w-0">
                        <div className="text-sm font-medium text-gray-900 max-w-[220px] truncate" title={lead.name}>{lead.name}</div>
                        <div className="text-sm text-gray-500 max-w-[240px] truncate" title={lead.title}>{lead.title}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-[260px] truncate" title={lead.email}>{lead.email}</div>
                    <div className="text-sm text-gray-500 max-w-[200px] truncate" title={lead.phone}>{lead.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      lead.status === 'Interested'
                        ? 'bg-green-100 text-green-800'
                        : lead.status === 'Not Interested'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 items-center max-w-[360px] overflow-hidden">
                      {(lead.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs flex items-center gap-1"
                        >
                          {tag}
                          <button
                            className="ml-1 text-xs text-red-500 hover:text-red-700"
                            onClick={e => { e.stopPropagation(); handleRemoveTag(lead.id, tag); }}
                            title="Remove tag"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      {tagEditLeadId === lead.id ? (
                        <input
                          ref={el => tagInputRefs.current[lead.id] = el}
                          className="border rounded px-2 py-0.5 text-xs w-24 ml-1"
                          value={tagInputValue}
                          onChange={e => setTagInputValue(e.target.value)}
                          onKeyDown={e => handleTagInputKey(e, lead.id)}
                          onBlur={() => setTagEditLeadId(null)}
                          autoFocus
                        />
                      ) : (
                        <button
                          className="ml-1 text-xs text-blue-500 hover:text-blue-700 px-2 py-0.5 border border-blue-200 rounded"
                          onClick={e => { e.stopPropagation(); setTagEditLeadId(lead.id); setTagInputValue(''); setTimeout(() => tagInputRefs.current[lead.id]?.focus(), 0); }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4"><div className="max-w-[240px] truncate" title={lead.location || 'Unknown'}>{lead.location || 'Unknown'}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.source || 'Unknown'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(lead.updatedAt).toLocaleDateString()}
                    <div className="text-xs text-gray-400 max-w-[220px] truncate" title={lead.campaign}>{lead.campaign}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative actions-menu flex items-center justify-end gap-2">
                      {!lead.email && (
                        <button
                          className="inline-flex items-center px-3 py-1 border border-purple-500 text-purple-700 bg-purple-50 rounded hover:bg-purple-100 disabled:opacity-50"
                          onClick={(e) => { e.stopPropagation(); handleEnrich(lead.id); }}
                          disabled={isEnriching === lead.id}
                          title="Enrich with Apollo"
                        >
                          {isEnriching === lead.id ? (
                            <svg className="animate-spin h-4 w-4 mr-1 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                            </svg>
                          ) : (
                            <FaWandMagicSparkles className="mr-1" />
                          )}
                          Enrich
                        </button>
                      )}
                      <button 
                        className="text-gray-400 hover:text-gray-600"
                        onClick={(e) => handleActionsClick(e, lead.id)}
                      >
                        <FaEllipsisV />
                      </button>
                      {showActionsMenu === lead.id && (
                        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                          <div className="py-1" role="menu" aria-orientation="vertical">
                            <button
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={(e) => handleAction('edit', lead, e)}
                            >
                              <FaEdit className="mr-3" /> Edit
                            </button>
                            <button
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={(e) => handleAction('message', lead, e)}
                            >
                              <FaEnvelope className="mr-3" /> Message
                            </button>
                            <button
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={(e) => { e.stopPropagation(); handleIndividualConvert(lead); }}
                            >
                              <FaUserPlus className="mr-3" /> Convert to Candidate
                            </button>
                            <button
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={(e) => { e.stopPropagation(); handleAttachSingleLead(lead.id); }}
                            >
                              <FaLinkIcon className="mr-3" /> Attach to Campaign
                            </button>
                            <button
                              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                              onClick={(e) => handleAction('delete', lead, e)}
                            >
                              <FaTrashAlt className="mr-3" /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-500">
            Showing {filteredLeads.length === 0 ? 0 : ((currentPage - 1) * LEADS_PER_PAGE + 1)} to {Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length} results
          </div>
          <div className="flex gap-2">
            <button
              className="border px-4 py-2 rounded-lg hover:bg-gray-50"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="border px-4 py-2 rounded-lg bg-purple-600 text-white">
              {currentPage}
            </span>
            <button
              className="border px-4 py-2 rounded-lg hover:bg-gray-50"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
            </button>
          </div>
        </div>
        </>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Delete Lead</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {leadToDelete?.name}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => setShowConfirmDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEditModal && editedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Edit Lead</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowEditModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      formErrors.name ? 'border-red-500' : ''
                    }`}
                    value={editedLead.name}
                    onChange={(e) => {
                      setEditedLead({ ...editedLead, name: e.target.value });
                      if (formErrors.name) {
                        setFormErrors({ ...formErrors, name: null });
                      }
                    }}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      formErrors.email ? 'border-red-500' : ''
                    }`}
                    value={editedLead.email}
                    onChange={(e) => {
                      setEditedLead({ ...editedLead, email: e.target.value });
                      if (formErrors.email) {
                        setFormErrors({ ...formErrors, email: null });
                      }
                    }}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      formErrors.phone ? 'border-red-500' : ''
                    }`}
                    value={editedLead.phone}
                    onChange={(e) => {
                      setEditedLead({ ...editedLead, phone: e.target.value });
                      if (formErrors.phone) {
                        setFormErrors({ ...formErrors, phone: null });
                      }
                    }}
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.phone}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      formErrors.title ? 'border-red-500' : ''
                    }`}
                    value={editedLead.title}
                    onChange={(e) => {
                      setEditedLead({ ...editedLead, title: e.target.value });
                      if (formErrors.title) {
                        setFormErrors({ ...formErrors, title: null });
                      }
                    }}
                  />
                  {formErrors.title && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.title}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      formErrors.location ? 'border-red-500' : ''
                    }`}
                    value={editedLead.location}
                    onChange={(e) => {
                      setEditedLead({ ...editedLead, location: e.target.value });
                      if (formErrors.location) {
                        setFormErrors({ ...formErrors, location: null });
                      }
                    }}
                  />
                  {formErrors.location && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.location}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      formErrors.status ? 'border-red-500' : ''
                    }`}
                    value={editedLead.status}
                    onChange={(e) => {
                      setEditedLead({ ...editedLead, status: e.target.value });
                      if (formErrors.status) {
                        setFormErrors({ ...formErrors, status: null });
                      }
                    }}
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Interested">Interested</option>
                    <option value="Not Interested">Not Interested</option>
                  </select>
                  {formErrors.status && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.status}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <input
                    type="text"
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      formErrors.tags ? 'border-red-500' : ''
                    }`}
                    value={editedLead.tags.join(', ')}
                    onChange={(e) => {
                      setEditedLead({ 
                        ...editedLead, 
                        tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                      });
                      if (formErrors.tags) {
                        setFormErrors({ ...formErrors, tags: null });
                      }
                    }}
                    placeholder="Enter tags separated by commas"
                  />
                  {formErrors.tags && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.tags}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  onClick={() => {
                    setShowEditModal(false);
                    setFormErrors({});
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {showMessageModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Send Message to {selectedLead.name}</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowMessageModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleMessageSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 h-32"
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Type your message here..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  onClick={() => setShowMessageModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert to Candidate Modal */}
      {showConvertModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Convert {selectedLead.name} to Candidate</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowConvertModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleConvertSubmit}>
              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  This will convert {selectedLead.name} from a lead to a candidate. You'll be able to manage them in the candidates section.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-700">
                    Note: This action cannot be undone. The lead will be removed from the leads list and added to candidates.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  onClick={() => setShowConvertModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Converting...' : 'Convert to Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Profile Drawer */}
      {showDrawer && selectedLead && (
        <LeadProfileDrawer
          lead={selectedLead}
          onClose={() => setShowDrawer(false)}
          isOpen={showDrawer}
          onLeadUpdated={(updatedLead) => {
            const enrichment =
              typeof updatedLead.enrichment_data === 'string'
                ? (() => { try { return JSON.parse(updatedLead.enrichment_data); } catch { return {}; } })()
                : updatedLead.enrichment_data || {};

            const computedLocation = [updatedLead.city, updatedLead.state, updatedLead.country]
              .filter(Boolean)
              .join(', ')
              || updatedLead.campaign_location
              || updatedLead.location
              || enrichment.location
              || 'Unknown';

            const normalizeSource = (val) => {
              if (!val) return null;
              const v = String(val).trim().toLowerCase();
              if (v === 'apollo') return 'Apollo';
              if (v === 'sales navigator' || v === 'sales_navigator' || v === 'phantombuster' || v === 'phantom') return 'Sales Navigator';
              if (v === 'chrome extension') return 'Chrome Extension';
              return val;
            };

            const computedSource = normalizeSource(updatedLead.enrichment_source)
              || normalizeSource(updatedLead.source)
              || normalizeSource(enrichment.source)
              || 'Unknown';

            const mappedLead = {
              ...updatedLead,
              enrichment,
              source: computedSource,
              location: computedLocation,
              workHistory: enrichment.workHistory || [],
              gptNotes: enrichment.gptNotes || '',
            };
            setLeads(leads.map(l => l.id === mappedLead.id ? mappedLead : l));
            setSelectedLead(mappedLead);
          }}
        />
      )}

      {/* Bulk Message Modal */}
      {showBulkMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Bulk Message to {selectedLeadIds.length} Leads</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowBulkMessageModal(false)}><FaTimes /></button>
            </div>
            {/* Provider Selection */}
            <div className="mb-4 flex items-center gap-3">
              <span className="font-medium text-gray-700">Send with:</span>
              <button
                type="button"
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border ${selectedProvider === 'google' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} text-sm`}
                onClick={() => setSelectedProvider('google')}
                disabled={!providerStatus.google}
              >
                <FaGoogle className="text-red-600" /> Google
                <FaCircle className={`text-xs ml-1 ${providerStatus.google ? 'text-green-500' : 'text-gray-300'}`} />
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border ${selectedProvider === 'outlook' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} text-sm`}
                onClick={() => setSelectedProvider('outlook')}
                disabled={!providerStatus.outlook}
              >
                <FaMicrosoft className="text-blue-600" /> Outlook
                <FaCircle className={`text-xs ml-1 ${providerStatus.outlook ? 'text-green-500' : 'text-gray-300'}`} />
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border ${selectedProvider === 'sendgrid' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} text-sm`}
                onClick={() => setSelectedProvider('sendgrid')}
                disabled={!providerStatus.sendgrid}
              >
                <FaEnvelope className="text-green-600" /> SendGrid
                <FaCircle className={`text-xs ml-1 ${providerStatus.sendgrid ? 'text-green-500' : 'text-gray-300'}`} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Template</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={bulkSelectedTemplate?.id || ''}
                onChange={e => {
                  const t = bulkTemplates.find(t => t.id === e.target.value);
                  if (t) handleBulkTemplateSelect(t);
                }}
              >
                <option value="">-- Select a template --</option>
                {bulkTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {bulkSelectedTemplate && (
              <div className="mb-6">
                <h4 className="font-semibold mb-2">Preview & Edit Messages</h4>
                <div className="max-h-64 overflow-y-auto divide-y">
                  {leads.filter(l => selectedLeadIds.includes(l.id)).map(lead => (
                    <div key={lead.id} className="py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <img src={lead.avatar} alt={lead.name} className="w-8 h-8 rounded-full" />
                        <span className="font-medium">{lead.name}</span>
                        <span className="text-xs text-gray-500">{lead.email}</span>
                        <button
                          className="ml-2 px-2 py-1 text-xs rounded border border-gray-300 bg-gray-50 hover:bg-gray-100"
                          onClick={() => handleTogglePreview(lead.id)}
                        >
                          {bulkPreviewModes[lead.id] ? 'Edit' : 'Preview'}
                        </button>
                      </div>
                      {bulkPreviewModes[lead.id] ? (
                        <div
                          className="w-full border rounded px-3 py-2 mt-1 text-sm bg-gray-50 whitespace-pre-wrap"
                          style={{ minHeight: '72px' }}
                          dangerouslySetInnerHTML={{
                            __html: (bulkMessages[lead.id] || '').replace(/\n/g, '<br/>'),
                          }}
                        />
                      ) : (
                        <textarea
                          className="w-full border rounded px-3 py-2 mt-1 text-sm"
                          rows={3}
                          value={bulkMessages[lead.id] || ''}
                          onChange={e => handleBulkMessageEdit(lead.id, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    onClick={handleBulkSend}
                    disabled={bulkIsSending}
                  >
                    {bulkIsSending ? 'Sending...' : 'Send to All'}
                  </button>
                  <button
                    className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                    onClick={() => setShowBulkSchedule(true)}
                    disabled={bulkIsSending}
                  >
                    <FaClock />
                    Schedule
                  </button>
                  <button
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                    onClick={handleBulkSaveTemplate}
                    disabled={bulkIsSavingTemplate}
                  >
                    {bulkIsSavingTemplate ? 'Saving...' : 'Save as Template'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Schedule Modal */}
      {showBulkSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Schedule Bulk Messages</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowBulkSchedule(false)}
              >
                <FaTimes />
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              Pick a date and time to send messages to {selectedLeadIds.length} leads.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule Date & Time
              </label>
              <DatePicker
                selected={bulkScheduledDate}
                onChange={date => setBulkScheduledDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="MMMM d, yyyy h:mm aa"
                className="border rounded px-3 py-2 w-full"
                minDate={new Date()}
                placeholderText="Select date and time"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => setShowBulkSchedule(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                onClick={handleBulkSchedule}
                disabled={!bulkScheduledDate}
              >
                Schedule Messages
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sequence Picker Modal */}
      {showSequencePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Enroll in Tiered Template</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowSequencePicker(false)}><FaTimes /></button>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Sequence</label>
              <select className="border rounded px-3 py-2 w-full" value={selectedSequenceId} onChange={e => setSelectedSequenceId(e.target.value)}>
                <option value="">-- Select --</option>
                {sequences.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({(s.steps||[]).length} steps)</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                <DatePicker selected={sequenceStart} onChange={setSequenceStart} showTimeSelect timeIntervals={15} dateFormat="MMM d, yyyy h:mm aa" className="border rounded px-3 py-2 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select className="border rounded px-3 py-2 w-full" value={sequenceTz} onChange={e => setSequenceTz(e.target.value)}>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-4">
              {selectedSequenceId ? `This will enroll ${selectedLeadIds.length} lead(s) into the selected sequence.` : 'Pick a sequence to see details.'}
            </div>
            {/* Provider Selection */}
            <div className="mb-4 flex items-center gap-3">
              <span className="font-medium text-gray-700">Send with:</span>
              <button
                type="button"
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border ${sequenceProvider === 'google' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} text-sm`}
                onClick={() => setSequenceProvider('google')}
              >
                <i className="fa-brands fa-google text-red-600" /> Google
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border ${sequenceProvider === 'outlook' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} text-sm`}
                onClick={() => setSequenceProvider('outlook')}
              >
                <i className="fa-brands fa-microsoft text-blue-600" /> Outlook
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border ${sequenceProvider === 'sendgrid' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} text-sm`}
                onClick={() => setSequenceProvider('sendgrid')}
              >
                <i className="fa-regular fa-envelope text-green-600" /> SendGrid
              </button>
            </div>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border rounded-lg hover:bg-gray-50" onClick={() => setShowSequencePicker(false)}>Cancel</button>
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                disabled={!selectedSequenceId}
                onClick={async ()=>{
                  try{
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    const res = await fetch(`${API_BASE_URL}/sequences/${selectedSequenceId}/enroll`,{
                      method:'POST',
                      headers:{ 'Content-Type':'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {})},
                      credentials:'include',
                      body: JSON.stringify({ leadIds: selectedLeadIds, startTimeLocal: sequenceStart.toISOString(), timezone: sequenceTz, provider: sequenceProvider })
                    });
                    if(!res.ok) throw new Error('Failed to enroll');
                    setShowSequencePicker(false);
                    toast.success('Leads enrolled');
                  }catch(e){ toast.error(e.message||'Failed'); }
                }}
              >
                Enroll
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Convert Confirmation Dialog */}
      {showBulkConvertDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Convert to Candidate</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to convert {selectedLeadIds.length} leads to candidates? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => setShowBulkConvertDialog(false)}
                disabled={isBulkConverting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                onClick={handleBulkConvert}
                disabled={isBulkConverting}
              >
                {isBulkConverting ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Confirmation Dialog */}
      {showBulkExportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Export Leads</h3>
            <p className="text-gray-600 mb-6">
              You are about to export {selectedLeadIds.length} leads. Continue?
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => setShowBulkExportDialog(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                onClick={handleBulkExport}
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bulk Delete Confirmation Dialog */}
      {showBulkDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Delete Leads</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedLeadIds.length} leads? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => setShowBulkDeleteDialog(false)}
                disabled={isBulkDeleting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Tag Modal */}
      {showBulkTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Tag to Leads</h3>
                             <button
                 className="text-gray-400 hover:text-gray-600"
                 onClick={() => {
                   setShowBulkTagModal(false);
                   setBulkTagInput('');
                 }}
               >
                 <FaTimes />
               </button>
            </div>
            <p className="text-gray-600 mb-4">
              Add a tag to {selectedLeadIds.length} selected lead(s).
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tag Name
              </label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Enter tag name"
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBulkTag()}
                autoFocus
              />
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Existing tags on selected leads will be preserved. This tag will be added to all selected leads.
              </p>
            </div>
            <div className="flex justify-end gap-3">
                             <button
                 className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                 onClick={() => {
                   setShowBulkTagModal(false);
                   setBulkTagInput('');
                 }}
               >
                 Cancel
               </button>
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                onClick={handleBulkTag}
                disabled={isBulkTagging || !bulkTagInput.trim()}
              >
                {isBulkTagging ? 'Adding Tag...' : 'Add Tag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-lg w-full shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold">Add New Lead</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowAddLeadModal(false)}><FaTimes /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              // Validation
              const errors = {};
              if (!addLeadForm.name.trim()) errors.name = 'Name is required';
              if (!addLeadForm.email.trim()) errors.email = 'Email is required';
              else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addLeadForm.email)) errors.email = 'Invalid email';
              setAddLeadErrors(errors);
              if (Object.keys(errors).length > 0) return;
              setIsAddingLead(true);
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('User not authenticated');
                const { error } = await supabase.from('leads').insert({
                  user_id: user.id,
                  name: addLeadForm.name,
                  email: addLeadForm.email,
                  phone: addLeadForm.phone,
                  title: addLeadForm.title,
                  company: addLeadForm.company,
                  linkedin_url: addLeadForm.linkedin_url,
                  status: addLeadForm.status,
                  tags: addLeadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
                  location: addLeadForm.location,
                  campaign: addLeadForm.campaign,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                if (error) throw error;
                setShowAddLeadModal(false);
                setAddLeadForm({ name: '', email: '', phone: '', title: '', company: '', linkedin_url: '', status: 'New', tags: '', location: '', campaign: '' });
                setAddLeadErrors({});
                toast.success('Lead added!');
                // Refresh leads
                const data = await getLeads();
                setLeads(data.map((lead) => ({
                  ...lead,
                  enrichment: typeof lead.enrichment_data === 'string' ? JSON.parse(lead.enrichment_data) : lead.enrichment_data || {},
                  avatar: getAvatarUrl(lead.name),
                  tags: lead.tags || [],
                })));
              } catch (err) {
                toast.error(err.message || 'Failed to add lead');
              } finally {
                setIsAddingLead(false);
              }
            }}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name<span className="text-red-500">*</span></label>
                  <input type="text" className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${addLeadErrors.name ? 'border-red-500' : ''}`} value={addLeadForm.name} onChange={e => setAddLeadForm(f => ({ ...f, name: e.target.value }))} />
                  {addLeadErrors.name && <p className="text-xs text-red-500 mt-1">{addLeadErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email<span className="text-red-500">*</span></label>
                  <input type="email" className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${addLeadErrors.email ? 'border-red-500' : ''}`} value={addLeadForm.email} onChange={e => setAddLeadForm(f => ({ ...f, email: e.target.value }))} />
                  {addLeadErrors.email && <p className="text-xs text-red-500 mt-1">{addLeadErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500" value={addLeadForm.phone} onChange={e => setAddLeadForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500" value={addLeadForm.title} onChange={e => setAddLeadForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500" value={addLeadForm.company} onChange={e => setAddLeadForm(f => ({ ...f, company: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500" value={addLeadForm.linkedin_url} onChange={e => setAddLeadForm(f => ({ ...f, linkedin_url: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500" value={addLeadForm.status} onChange={e => setAddLeadForm(f => ({ ...f, status: e.target.value }))} >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Interested">Interested</option>
                    <option value="Not Interested">Not Interested</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags <span className="text-xs text-gray-400">(comma separated)</span></label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500" value={addLeadForm.tags} onChange={e => setAddLeadForm(f => ({ ...f, tags: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500" value={addLeadForm.location} onChange={e => setAddLeadForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500" value={addLeadForm.campaign} onChange={e => setAddLeadForm(f => ({ ...f, campaign: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" className="px-4 py-2 border rounded-lg hover:bg-gray-50" onClick={() => setShowAddLeadModal(false)} disabled={isAddingLead}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50" disabled={isAddingLead}>{isAddingLead ? 'Adding...' : 'Add Lead'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach to Campaign Modal */}
      <AttachToCampaignModal
        isOpen={showAttachToCampaignModal}
        onClose={() => setShowAttachToCampaignModal(false)}
        leadIds={attachLeadIds}
        onSuccess={handleAttachSuccess}
      />
    </div>
  );
}

export default LeadManagement;

