import React, { useState, useRef, useEffect } from 'react';
import { FaInbox, FaPaperPlane, FaFile, FaStar, FaTrash, FaPenToSquare, FaPlus, FaFileLines, FaFilter, FaSort, FaAddressBook, FaBold, FaItalic, FaUnderline, FaListUl, FaListOl, FaLink, FaPaperclip, FaPuzzlePiece, FaChevronDown, FaClock, FaRegStar, FaRegBell, FaGoogle, FaMicrosoft, FaEnvelope, FaCircle } from 'react-icons/fa6';
import { FaSearch, FaSave, FaTimes } from 'react-icons/fa';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { replaceTokens } from '../utils/tokenReplace';
import SequencesTab from '../components/sequences/SequencesTab';
import { usePlan } from '../context/PlanContext';
import SequenceBuilderModal from '../components/sequences/SequenceBuilderModal';

// Backend base URL (same env var used elsewhere)
const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

// Helper function to generate avatar URL
const getAvatarUrl = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

const baseFolders = [
  { name: 'Inbox', icon: <FaInbox /> },
  { name: 'Sent', icon: <FaPaperPlane /> },
  { name: 'Drafts', icon: <FaFile /> },
  { name: 'Templates', icon: <FaFileLines /> },
  { name: 'Trash', icon: <FaTrash /> },
];

export default function MessagingCenter() {
  const { isFree } = usePlan();
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showComposer, setShowComposer] = useState(true);
  const [messageBody, setMessageBody] = useState('');
  const quillRef = useRef();
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [pendingMessage, setPendingMessage] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const tokens = [
    { label: 'Candidate First Name', value: '{{Candidate.FirstName}}' },
    { label: 'Candidate Job', value: '{{Candidate.Job}}' },
    { label: 'Candidate Company', value: '{{Candidate.Company}}' },
    { label: 'Job Title', value: '{{Job.Title}}' },
    { label: 'Job Company', value: '{{Job.Company}}' },
  ];
  const [activeFolder, setActiveFolder] = useState('Inbox');
  const [folders, setFolders] = useState(baseFolders);
  const [messageList, setMessageList] = useState([]);
  const [toField, setToField] = useState('Emily Johnson <emily.johnson@example.com>');
  const [subjectField, setSubjectField] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerStatus, setProviderStatus] = useState({
    google: false,
    outlook: false,
    sendgrid: false
  });
  const [attachments, setAttachments] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [activeSubtab, setActiveSubtab] = useState('Templates');
  const [showSequenceBuilder, setShowSequenceBuilder] = useState(false);
  const [editingSequence, setEditingSequence] = useState(null);
  // Bulk selection state for inbox list
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Template management state
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateType, setTemplateType] = useState('email'); // 'email' | 'linkedin_request'
  const [templateContent, setTemplateContent] = useState('');

  // Helper to map folder to status
  const folderToStatus = {
    Inbox: 'inbox', // You may want to implement this later
    Sent: 'sent',
    Drafts: 'draft',
    Trash: 'trash',
  };

  // Fetch provider status and REX status
  const fetchProviderStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Fetch Google connection from google_accounts
    const { data: googleData } = await supabase
      .from('google_accounts')
      .select('status')
      .eq('user_id', user.id)
      .single();
    // Fetch other providers from integrations
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
    if (otherData) {
      otherData.forEach(row => {
        if (row.status === 'connected') {
          status[row.provider] = true;
        }
      });
    }
    setProviderStatus(status);
    const firstConnected = Object.keys(status).find(p => status[p]);
    if (firstConnected) setSelectedProvider(firstConnected);
    else setSelectedProvider(null);
    console.log('Provider status:', status, 'First connected:', firstConnected);

    // Check REX (agent mode) from user_settings and add Replies link at position below Inbox
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let enabled = false;
      let roleAllowed = false;
      if (authUser) {
        const [{ data: settings }, { data: userRow }] = await Promise.all([
          supabase.from('user_settings').select('agent_mode_enabled').eq('user_id', authUser.id).maybeSingle(),
          supabase.from('users').select('role').eq('id', authUser.id).maybeSingle(),
        ]);
        enabled = !!settings?.agent_mode_enabled;
        const role = (userRow?.role || '').toString();
        roleAllowed = ['team_admin','admin','RecruitPro','recruiter','SuperAdmin','super_admin'].includes(role);
      }
      setFolders(prev => {
        const without = prev.filter(f => f.name !== 'Replies');
        if (enabled || roleAllowed) {
          const next = [...without];
          next.splice(1, 0, { name: 'Replies', icon: <FaInbox /> });
          return next;
        }
        return without;
      });
    } catch (_) {}
  };

  // Fetch messages for a folder
  const fetchMessages = async (folder) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    let query = supabase
      .from('messages')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false });
    
    // Handle different folder types
    if (folder === 'Trash') {
      // Trash folder shows all messages with status 'trash'
      query = query.eq('status', 'trash');
    } else if (folder === 'Sent') {
      // Sent folder shows only sent (hide trashed)
      query = query.eq('status', 'sent');
    } else if (folder === 'Drafts') {
      // Drafts folder shows only draft messages (not trashed)
      query = query.eq('status', 'draft');
    } else if (folder === 'Inbox') {
      // Inbox shows non-trashed sent messages for now
      query = query.eq('status', 'sent');
    }
    
    const { data, error } = await query;
    if (!error && data) {
      // Filter out trashed messages from non-trash folders, but keep them in Sent for reference
      if (folder === 'Trash') {
        setMessageList(data);
      } else {
        // For other folders, hide trashed items entirely
        setMessageList((data || []).filter(m => m.status !== 'trash'));
      }
    } else {
      setMessageList([]);
    }
  };

  // Fetch provider status on mount
  useEffect(() => {
    fetchProviderStatus();
  }, []);

  // Fetch messages on mount and when folder changes
  useEffect(() => {
    fetchMessages(activeFolder);
  }, [activeFolder]);

  // On mount, check for selectedLead in localStorage (for Message Again wire)
  useEffect(() => {
    const leadData = JSON.parse(localStorage.getItem('selectedLead'));
    if (leadData) {
      setToField(`${leadData.name} <${leadData.email}>`);
      // Optionally set subject and message body here as well
      setShowComposer(true);
      setSelectedLead(leadData); // Store the lead for token replacement
      localStorage.removeItem('selectedLead');
    }
  }, []);

  // Listen for lead selection event
  useEffect(() => {
    const handleLeadSelected = () => {
      const leadData = JSON.parse(localStorage.getItem('selectedLead'));
      if (leadData) {
        setToField(leadData.email);
        setSelectedLead(leadData);
        localStorage.removeItem('selectedLead');
      }
    };
    window.addEventListener('storage', handleLeadSelected);
    return () => window.removeEventListener('storage', handleLeadSelected);
  }, []);

  // Fetch templates function
  const fetchTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setTemplates(data);
    }
  };

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleInsertToken = (token) => {
    const quill = quillRef.current.getEditor();
    const range = quill.getSelection(true);
    quill.insertText(range.index, token, 'user');
    setShowTokenDropdown(false);
  };
  // Track unsaved changes
  const handleBodyChange = (val) => {
    setMessageBody(val);
    setUnsaved(true);
  };
  // Handle inbox click with unsaved check
  const handleInboxClick = (msg) => {
    if (showComposer && unsaved) {
      setPendingMessage(msg);
      setShowPrompt(true);
    } else {
      setSelectedMessage(msg);
      setShowComposer(false);
      setUnsaved(false);
    }
  };
  // Handle folder click with unsaved check
  const handleFolderClick = (folder) => {
    if (showComposer && unsaved) {
      setPendingMessage(null);
      setShowPrompt(true);
      setPendingMessage({ folder });
    } else {
      setActiveFolder(folder);
      setSelectedMessage(null);
      setShowComposer(false);
      setUnsaved(false);
    }
  };
  // Update prompt action to handle folder switch
  const handlePromptAction = (action) => {
    if (action === 'cancel') {
      setShowPrompt(false);
      setPendingMessage(null);
      return;
    }
    if (action === 'discard') {
      setShowPrompt(false);
      if (pendingMessage && pendingMessage.folder) {
        setActiveFolder(pendingMessage.folder);
        setMessageList([]);
        setSelectedMessage(null);
        setShowComposer(false);
        setUnsaved(false);
        setPendingMessage(null);
        return;
      }
      setShowComposer(false);
      setSelectedMessage(pendingMessage);
      setUnsaved(false);
      setPendingMessage(null);
      return;
    }
    if (action === 'save') {
      alert('Message saved as template!');
    }
    if (action === 'send') {
      alert('Message sent!');
    }
    setShowPrompt(false);
    if (pendingMessage && pendingMessage.folder) {
      setActiveFolder(pendingMessage.folder);
      setMessageList([]);
      setSelectedMessage(null);
      setShowComposer(false);
      setUnsaved(false);
      setPendingMessage(null);
      return;
    }
    setShowComposer(false);
    setSelectedMessage(pendingMessage);
    setUnsaved(false);
    setPendingMessage(null);
  };
  // Update subject when selecting a message
  React.useEffect(() => {
    if (selectedMessage) setSubjectField(selectedMessage.subject);
  }, [selectedMessage]);
  // Quill modules with default toolbar
  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const newAttachments = files.map(file => ({
      filename: file.name,
      content: file,
      contentType: file.type
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    // Personalize subject using selected lead data if present
    if (selectedLead && template.subject) {
      const data = {
        Candidate: {
          FirstName: selectedLead.name ? selectedLead.name.split(' ')[0] : '',
          LastName: selectedLead.name ? selectedLead.name.split(' ').slice(1).join(' ') : '',
          Company: selectedLead.company || '',
          Job: selectedLead.title || '',
          Email: selectedLead.email || '',
          LinkedIn: selectedLead.linkedin_url || ''
        },
        first_name: selectedLead.name ? selectedLead.name.split(' ')[0] : '',
        last_name: selectedLead.name ? selectedLead.name.split(' ').slice(1).join(' ') : '',
        full_name: selectedLead.name || '',
        company: selectedLead.company || '',
        title: selectedLead.title || '',
        email: selectedLead.email || ''
      };
      setSubjectField(replaceTokens(template.subject, data));
    } else {
      setSubjectField(template.subject);
    }
    const data = selectedLead ? {
      Candidate: {
        FirstName: selectedLead.name ? selectedLead.name.split(' ')[0] : '',
        LastName: selectedLead.name ? selectedLead.name.split(' ').slice(1).join(' ') : '',
        Company: selectedLead.company || '',
        Job: selectedLead.title || '',
        Email: selectedLead.email || '',
        LinkedIn: selectedLead.linkedin_url || ''
      },
      first_name: selectedLead.name ? selectedLead.name.split(' ')[0] : '',
      last_name: selectedLead.name ? selectedLead.name.split(' ').slice(1).join(' ') : '',
      full_name: selectedLead.name || '',
      company: selectedLead.company || '',
      title: selectedLead.title || '',
      email: selectedLead.email || ''
    } : {};
    setMessageBody(replaceTokens(template.content, data));
    setShowTemplateModal(false);
  };

  // Template management functions
  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateSubject('');
    setTemplateType('email');
    setTemplateContent('');
    setShowTemplateEditor(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateSubject(template.subject);
    setTemplateType((template.subject||'')==='linkedin_request' ? 'linkedin_request' : 'email');
    setTemplateContent(template.content);
    setShowTemplateEditor(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const templateData = {
        user_id: user.id,
        name: templateName,
        subject: templateType === 'linkedin_request' ? 'linkedin_request' : templateSubject,
        content: templateContent,
        updated_at: new Date().toISOString()
      };

      if (editingTemplate) {
        // Update existing template
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', editingTemplate.id)
          .eq('user_id', user.id);
        if (error) throw error;
        toast.success('Template updated!');
      } else {
        // Create new template
        templateData.created_at = new Date().toISOString();
        const { error } = await supabase
          .from('email_templates')
          .insert(templateData);
        if (error) throw error;
        toast.success('Template created!');
      }

      // Refresh templates
      await fetchTemplates();
      setShowTemplateEditor(false);
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error(err.message || 'Failed to save template');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      toast.success('Template deleted!');
      await fetchTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      toast.error(err.message || 'Failed to delete template');
    }
  };

  const handleDuplicateTemplate = async (template) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('email_templates')
        .insert({
          user_id: user.id,
          name: `${template.name} (Copy)`,
          subject: template.subject,
          content: template.content,
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
      toast.success('Template duplicated!');
      await fetchTemplates();
    } catch (err) {
      console.error('Error duplicating template:', err);
      toast.error(err.message || 'Failed to duplicate template');
    }
  };



  const handleSend = async () => {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Convert attachments to a format suitable for Supabase
      const processedAttachments = attachments.length > 0 ? await Promise.all(
        attachments.map(async (attachment) => {
          const buffer = await attachment.content.arrayBuffer();
          return {
            filename: attachment.filename,
            content_type: attachment.contentType,
            size: buffer.byteLength
          };
        })
      ) : [];

      // Replace tokens in message body with selected lead data
      const data = selectedLead ? {
        Candidate: {
          FirstName: selectedLead.name ? selectedLead.name.split(' ')[0] : '',
          LastName: selectedLead.name ? selectedLead.name.split(' ').slice(1).join(' ') : '',
          Company: selectedLead.company || '',
          Job: selectedLead.title || '',
          Email: selectedLead.email || ''
        },
        first_name: selectedLead.name ? selectedLead.name.split(' ')[0] : '',
        last_name: selectedLead.name ? selectedLead.name.split(' ').slice(1).join(' ') : '',
        full_name: selectedLead.name || '',
        company: selectedLead.company || '',
        title: selectedLead.title || '',
        email: selectedLead.email || ''
      } : {};

      const personalizedBody = replaceTokens(messageBody, data);
      const personalizedSubject = replaceTokens(subjectField, data);
      const htmlBody = personalizedBody.replace(/\n/g, '<br/>');

      // Send via backend API (will also store the message)
      const response = await fetch(`${API_BASE_URL}/message/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          to: toField,
          subject: personalizedSubject,
          html: htmlBody,
          provider: selectedProvider,
          attachments: attachments, // Send full attachments to API
          template_id: selectedTemplate?.id,
          template_data: {
            Candidate: {
              FirstName: selectedLead?.name ? selectedLead.name.split(' ')[0] : '',
              LastName: selectedLead?.name ? selectedLead.name.split(' ')[1] : '',
              Job: selectedLead?.title || '',
              Company: selectedLead?.company || ''
            }
          }
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send message');
      }

      toast.success('Message sent successfully!');
      setShowComposer(false);
      setAttachments([]);
      setSelectedTemplate(null);
      await fetchMessages(activeFolder);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
    }
  };

  // Update handleSaveDraft to use content instead of body
  const handleSaveDraft = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Convert attachments to a format suitable for Supabase
      const processedAttachments = attachments.length > 0 ? await Promise.all(
        attachments.map(async (attachment) => {
          const buffer = await attachment.content.arrayBuffer();
          return {
            filename: attachment.filename,
            content_type: attachment.contentType,
            size: buffer.byteLength
          };
        })
      ) : [];

      const payload = {
        user_id: session.user.id,
        recipient: toField,
        from_address: session.user.email || 'you@example.com',
        subject: subjectField || '(No Subject)',
        content: messageBody,
        status: 'draft',
        provider: selectedProvider,
        attachments: processedAttachments,
        lead_id: selectedLead?.id || null,
        read: true,
        sender: 'You',
        avatar: getAvatarUrl('You'),
        preview: messageBody.replace(/<[^>]+>/g, '').slice(0, 100),
        time: new Date().toLocaleTimeString(),
        unread: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Saving draft with payload:', payload);

      const { error: saveError } = await supabase
        .from('messages')
        .insert(payload);

      if (saveError) {
        console.error('Supabase save error:', saveError);
        throw saveError;
      }

      toast.success('Draft saved!');
      setShowComposer(false);
      await fetchMessages('Drafts');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error(error.message || 'Failed to save draft');
    }
  };

  // Add handleTrash function
  const handleTrash = async (messageId) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          status: 'trash',
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) throw error;

      toast.success('Message moved to trash');
      await fetchMessages(activeFolder);
    } catch (error) {
      console.error('Error moving message to trash:', error);
      toast.error('Failed to move message to trash');
    }
  };

  // Add restore function for trashed messages
  const handleRestore = async (messageId) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          status: 'sent', // Restore to sent status
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) throw error;

      toast.success('Message restored from trash');
      await fetchMessages(activeFolder);
    } catch (error) {
      console.error('Error restoring message:', error);
      toast.error('Failed to restore message');
    }
  };

  // Bulk selection helpers
  const isSelected = (id) => selectedIds.has(id);
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectAllVisible = () => {
    setSelectedIds(new Set(messageList.map(m => m.id)));
  };
  const allSelected = messageList.length > 0 && messageList.every(m => selectedIds.has(m.id));
  const toggleSelectAll = () => {
    if (allSelected) clearSelection(); else selectAllVisible();
  };
  const handleBulkTrash = async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('messages')
        .update({ status: 'trash', updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      toast.success('Selected messages moved to Trash');
      clearSelection();
      await fetchMessages(activeFolder);
    } catch (err) {
      console.error('Bulk trash failed', err);
      toast.error('Failed to move selected messages');
    }
  };
  // Clear selection when folder changes or list refreshes
  useEffect(() => { clearSelection(); }, [activeFolder]);

  // Update the message view to include a trash button
  const MessageView = ({ message }) => (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <img src={message.avatar} alt="Sender" className="w-10 h-10 rounded-full" />
            <div>
              <div className="font-semibold text-gray-900">{message.sender}</div>
              <div className="text-xs text-gray-500">{message.time}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {message.status === 'trash' || message.isTrashed ? (
              <button
                onClick={() => handleRestore(message.id)}
                className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                title="Restore from trash"
              >
                <FaRegStar />
                Restore
              </button>
            ) : (
              <button
                onClick={() => handleTrash(message.id)}
                className="text-gray-500 hover:text-red-600"
                title="Move to trash"
              >
                <FaTrash />
              </button>
            )}
          </div>
        </div>
        <div className="font-bold text-lg mb-1">{message.subject}</div>
        <div 
          className="text-gray-700 whitespace-pre-line" 
          dangerouslySetInnerHTML={{ 
            __html: (message.content || '').replace(/\n/g, '<br/>') 
          }} 
        />
      </div>
    </div>
  );

  // Compose button handler: show blank new message and reset state
  const handleCompose = () => {
    setShowComposer(true);
    setSelectedMessage(null);
    setToField('');
    setSubjectField('');
    setMessageBody('');
    setSelectedLead(null);
  };

  // Ensure only one compose form is rendered at a time
  // If showComposer is true, selectedMessage must be null
  useEffect(() => {
    if (showComposer && selectedMessage) {
      setSelectedMessage(null);
    }
  }, [showComposer, selectedMessage]);

  return (
    <div className="flex h-screen bg-base-50 font-inter">
      {/* Prompt Modal */}
      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">You have an unsaved message</h3>
            <p className="mb-4">Would you like to save as a template, send, discard, or cancel?</p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200" onClick={() => handlePromptAction('cancel')}>Cancel</button>
              <button className="px-4 py-2 rounded bg-yellow-100 hover:bg-yellow-200" onClick={() => handlePromptAction('save')}>Save as Template</button>
              <button className="px-4 py-2 rounded bg-blue-100 hover:bg-blue-200" onClick={() => handlePromptAction('send')}>Send</button>
              <button className="px-4 py-2 rounded bg-red-100 hover:bg-red-200" onClick={() => handlePromptAction('discard')}>Discard</button>
            </div>
          </div>
        </div>
      )}
      {/* Schedule Modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Schedule Message</h3>
            <p className="mb-4">Pick a date and time to send your message.</p>
            <DatePicker
              selected={scheduledDate}
              onChange={date => setScheduledDate(date)}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="MMMM d, yyyy h:mm aa"
              className="border rounded px-3 py-2 w-full mb-4"
              minDate={new Date()}
            />
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200" onClick={() => setShowSchedule(false)}>Cancel</button>
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  setShowSchedule(false);
                  alert(`Message scheduled for ${scheduledDate?.toLocaleString() || ''}`);
                  // Here you would add logic to save the scheduled message to backend
                }}
                disabled={!scheduledDate}
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowTemplateEditor(false)}
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="Enter template name..."
                />
              </div>
              
              {/* Template Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
                  value={templateType}
                  onChange={e => setTemplateType(e.target.value)}
                >
                  <option value="email">Email</option>
                  <option value="linkedin_request">LinkedIn Request (≤300 chars)</option>
                </select>
              </div>
              
              {/* Subject (email only) */}
              {templateType === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
                      value={templateSubject}
                      onChange={e => setTemplateSubject(e.target.value)}
                      placeholder="Enter subject line... Use tokens like {{Candidate.FirstName}}"
                    />
                    <div className="relative">
                      <button
                        type="button"
                        className="px-3 py-2 rounded bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100"
                        onClick={() => setShowTokenDropdown(v => !v)}
                      >
                        Insert Field
                      </button>
                      {showTokenDropdown && (
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg z-20">
                          {tokens.map(token => (
                            <button
                              key={token.value}
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50"
                              onClick={() => { setTemplateSubject(prev => prev + token.value); setShowTokenDropdown(false); }}
                            >
                              {token.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Insert Field dropdown */}
              <div className="mb-2">
                <div className="relative inline-block">
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-2 rounded bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100"
                    onClick={() => setShowTokenDropdown(v => !v)}
                  >
                    ⚙️ Insert Field
                  </button>
                  {showTokenDropdown && (
                    <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg z-20">
                      {tokens.map(token => (
                        <button
                          key={token.value}
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50"
                          onClick={() => {
                            // Insert token into template content
                            setTemplateContent(prev => prev + token.value);
                            setShowTokenDropdown(false);
                          }}
                        >
                          {token.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Template Content */}
              {templateType === 'email' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <div className="border border-gray-300 rounded-md shadow-sm">
                    <ReactQuill
                      theme="snow"
                      value={templateContent}
                      onChange={setTemplateContent}
                      className="min-h-[300px]"
                      modules={quillModules}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Message (max 300 chars)</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    maxLength={300}
                    rows={4}
                    value={templateContent}
                    onChange={e => setTemplateContent(e.target.value)}
                    placeholder="Hi {{first_name}} — great to connect! ..."
                  />
                  <div className="mt-1 text-xs text-gray-500 text-right">{templateContent.length}/300</div>
                  <p className="mt-1 text-xs text-gray-500">Tokens supported: {"{{first_name}}"}, {"{{last_name}}"}, {"{{company}}"}, {"{{title}}"}</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
                onClick={() => setShowTemplateEditor(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || !templateContent.trim() || (templateType==='email' && !templateSubject.trim()) || (templateType==='linkedin_request' && templateContent.length>300)}
              >
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Select Template</h3>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="p-4 border rounded-lg hover:border-blue-500 cursor-pointer flex items-center justify-between"
                >
                  <div onClick={() => handleTemplateSelect(template)} className="flex-1 min-w-0">
                    <h4 className="font-medium">{template.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{template.subject}</p>
                  </div>
                  <button
                    className="ml-4 text-red-500 hover:text-red-700 px-2 py-1 rounded"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error('User not authenticated');
                        const { error } = await supabase
                          .from('email_templates')
                          .delete()
                          .eq('id', template.id)
                          .eq('user_id', user.id);
                        if (error) throw error;
                        toast.success('Template deleted!');
                        // Refresh templates
                        const { data, error: fetchError } = await supabase
                          .from('email_templates')
                          .select('*')
                          .eq('user_id', user.id);
                        if (!fetchError && data) setTemplates(data);
                      } catch (err) {
                        console.error('Error deleting template:', err);
                        toast.error(err.message || 'Failed to delete template');
                      }
                    }}
                    title="Delete template"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                onClick={() => setShowTemplateModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col shadow-md">
        <div className="p-4">
          <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 px-4 w-full flex items-center justify-center gap-2 transition-colors shadow" onClick={handleCompose}>
            <FaPenToSquare />
            <span>Compose</span>
          </button>
        </div>
        <nav className="flex-1">
          <ul className="space-y-1 px-2">
            {folders.map((folder, idx) => (
              <li key={folder.name}>
                <span
                  className={`flex items-center px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${activeFolder === folder.name ? 'bg-blue-50 text-blue-700 font-semibold shadow' : 'text-gray-700 hover:bg-gray-100'}`}
                  onClick={() => {
                    if (folder.name === 'Replies') {
                      window.location.href = '/agent/inbox';
                      return;
                    }
                    handleFolderClick(folder.name);
                  }}
                >
                  {folder.icon}
                  <span className="ml-2">{folder.name}</span>
                </span>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-200">
          {/* Templates section in sidebar removed to prevent duplicate editor/toolbars. Use the template modal in the compose form instead. */}
        </div>
      </aside>

      {/* Message List */}
      <section className="w-1/3 border-r border-gray-200 overflow-y-auto flex flex-col bg-white shadow-md">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            {activeFolder !== 'Templates' && (
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={allSelected}
                onChange={toggleSelectAll}
                aria-label="Select all"
              />
            )}
            <h2 className="text-lg font-semibold text-gray-800">{activeFolder}</h2>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && activeFolder !== 'Trash' && (
              <button
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                onClick={handleBulkTrash}
              >
                <FaTrash /> Delete
              </button>
            )}
            <button className="text-gray-500 hover:text-gray-700"><FaFilter /></button>
            <button className="text-gray-500 hover:text-gray-700"><FaSort /></button>
          </div>
        </div>
        <div className="divide-y divide-gray-200 flex-1 overflow-y-auto">
          {messageList.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No messages in this folder.</div>
          ) : (
            messageList.map(msg => (
              <div
                key={msg.id}
                className={`p-4 hover:bg-blue-50 cursor-pointer transition-colors ${
                  selectedMessage && selectedMessage.id === msg.id && !showComposer 
                    ? 'bg-blue-100 border-l-4 border-blue-500 shadow' 
                    : ''
                } ${msg.isTrashed ? 'opacity-60 bg-gray-50' : ''}`}
                onClick={() => handleInboxClick(msg)}
              >
                <div className="flex items-start space-x-3">
                  {activeFolder !== 'Trash' && (
                    <input
                      type="checkbox"
                      className="mt-2 h-4 w-4"
                      checked={isSelected(msg.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(msg.id); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <img src={msg.avatar} alt="Sender" className="w-10 h-10 rounded-full flex-shrink-0 shadow" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <h3 className={`text-sm font-bold truncate ${msg.isTrashed ? 'text-gray-500' : 'text-gray-900'}`}>
                        {msg.sender}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${msg.isTrashed ? 'text-gray-400' : 'text-gray-400'}`}>
                          {msg.time}
                        </span>
                        {msg.isTrashed && (
                          <FaTrash className="text-xs text-gray-400" title="Moved to trash" />
                        )}
                      </div>
                    </div>
                    <p className={`text-sm font-semibold mt-1 ${msg.isTrashed ? 'text-gray-500' : 'text-gray-900'}`}>
                      {msg.subject}
                    </p>
                    <p className={`text-sm mt-1 truncate ${msg.isTrashed ? 'text-gray-400' : 'text-gray-600'}`}>
                      {msg.preview}
                    </p>
                    {msg.unread && !msg.isTrashed && (
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">Unread</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Right Pane: Composer or Message View */}
      <section className="flex-1 bg-white flex flex-col shadow-md">
        {/* Composer Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {activeFolder === 'Templates' 
              ? (activeSubtab === 'Sequences' ? 'Sequences' : 'Templates')
              : showComposer 
                ? 'New Message' 
                : selectedMessage 
                  ? 'Message' 
                  : 'No Message Selected'
            }
          </h2>
          {activeFolder !== 'Templates' && (
            <div className="flex items-center space-x-3">
              <button className="text-gray-500 hover:text-blue-600" onClick={handleSaveDraft}><FaSave /></button>
              <button className="text-gray-500 hover:text-blue-600" onClick={() => setShowComposer(true)}><FaTimes /></button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {activeFolder === 'Templates' ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <button className={`px-3 py-2 rounded-lg text-sm ${activeSubtab==='Templates'?'bg-gray-900 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setActiveSubtab('Templates')}>Templates</button>
                  <button className={`px-3 py-2 rounded-lg text-sm ${activeSubtab==='Sequences'?'bg-gray-900 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setActiveSubtab('Sequences')}>Sequences</button>
                </div>
                {activeSubtab==='Templates' ? (
                  <button
                    onClick={handleCreateTemplate}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <FaPlus className="mr-2" />
                    New Template
                  </button>
                ) : (
                  <button
                    onClick={() => { if (isFree) { window?.alert?.('Tiered Templates are a paid feature. Visit Billing to upgrade.'); return; } setEditingSequence(null); setShowSequenceBuilder(true); }}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm ${isFree ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'text-white bg-purple-600 hover:bg-purple-700'}`}
                  >
                    <FaPlus className="mr-2" />
                    New Tiered Template
                  </button>
                )}
              </div>
              {activeSubtab==='Templates' ? (
                <div className="grid gap-4">
                  {templates.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FaFileLines className="mx-auto text-4xl mb-4" />
                      <h3 className="text-lg font-medium mb-2">No templates yet</h3>
                      <p className="mb-4">Create your first email template to get started</p>
                      <button
                        onClick={handleCreateTemplate}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <FaPlus className="mr-2" />
                        Create Template
                      </button>
                    </div>
                  ) : (
                    templates.map(template => (
                      <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-medium text-gray-900 truncate">{template.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {(template.subject||'')==='linkedin_request' ? 'LinkedIn Request' : (template.subject||'')}
                            </p>
                            <div className="text-sm text-gray-500 mt-2 line-clamp-2">
                              {(template.content || '').replace(/<[^>]+>/g, '').slice(0, 150)}...
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Created {new Date(template.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <button onClick={() => handleEditTemplate(template)} className="text-blue-600 hover:text-blue-800 p-2" title="Edit template"><FaPenToSquare /></button>
                            <button onClick={() => handleDuplicateTemplate(template)} className="text-green-600 hover:text-green-800 p-2" title="Duplicate template"><FaPlus /></button>
                            <button onClick={() => handleDeleteTemplate(template.id)} className="text-red-600 hover:text-red-800 p-2" title="Delete template"><FaTrash /></button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <SequencesTab onEditSequence={(seq)=>{ setEditingSequence(seq); setShowSequenceBuilder(true); }} />
              )}
            </div>
          ) : showComposer && !selectedMessage ? (
            <form key="compose-form">
              {/* Provider Selection */}
              <div className="mb-4 flex items-center gap-4">
                <span className="font-medium text-gray-700">Send with:</span>
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300 ml-2"
                  onClick={fetchProviderStatus}
                >
                  Refresh Providers
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${selectedProvider === 'google' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} transition`}
                  onClick={() => setSelectedProvider('google')}
                  disabled={!providerStatus.google}
                >
                  <FaGoogle className="text-xl text-red-600" />
                  <span>Google</span>
                  <FaCircle className={`text-xs ml-1 ${providerStatus.google ? 'text-green-500' : 'text-gray-300'}`} />
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${selectedProvider === 'outlook' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} transition`}
                  onClick={() => setSelectedProvider('outlook')}
                  disabled={!providerStatus.outlook}
                >
                  <FaMicrosoft className="text-xl text-blue-600" />
                  <span>Outlook</span>
                  <FaCircle className={`text-xs ml-1 ${providerStatus.outlook ? 'text-green-500' : 'text-gray-300'}`} />
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${selectedProvider === 'sendgrid' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'} transition`}
                  onClick={() => setSelectedProvider('sendgrid')}
                  disabled={!providerStatus.sendgrid}
                >
                  <FaEnvelope className="text-xl text-green-600" />
                  <span>SendGrid</span>
                  <FaCircle className={`text-xs ml-1 ${providerStatus.sendgrid ? 'text-green-500' : 'text-gray-300'}`} />
                </button>
              </div>
              {/* To Field */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <div className="relative">
                  <input
                    type="text"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
                    value={toField}
                    onChange={e => setToField(e.target.value)}
                    placeholder="Type recipient..."
                  />
                  <button type="button" className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700">
                    <FaAddressBook />
                  </button>
                </div>
              </div>
              {/* CC/BCC Toggle */}
              <div className="mb-4">
                <button type="button" className="text-sm text-blue-600 hover:text-blue-800">Add Cc/Bcc</button>
              </div>
              {/* Subject Field */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
                  value={subjectField}
                  onChange={e => setSubjectField(e.target.value)}
                  placeholder="Type subject..."
                />
              </div>
              {/* Insert Field dropdown below toolbar, above message body */}
              <div className="mb-2">
                <div className="relative inline-block">
                  <button
                    type="button"
                    className="ql-insertField flex items-center gap-1 px-3 py-2 rounded bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100"
                    onClick={() => setShowTokenDropdown(v => !v)}
                  >
                    &#9881; Insert Field
                  </button>
                  {showTokenDropdown && (
                    <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg z-20">
                      {tokens.map(token => (
                        <button
                          key={token.value}
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50"
                          onClick={() => handleInsertToken(token.value)}
                        >
                          {token.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Template Selection */}
              <div className="mb-4">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => setShowTemplateModal(true)}
                >
                  {selectedTemplate ? `Using template: ${selectedTemplate.name}` : 'Select Template'}
                </button>
              </div>
              {/* Attachments */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Add Files
                  </label>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm text-gray-600">{attachment.filename}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Message Body (Rich Editor) */}
              <div className="mb-6 border border-gray-300 rounded-b-md shadow-sm">
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={messageBody}
                  onChange={handleBodyChange}
                  className="min-h-[200px]"
                  modules={quillModules}
                />
              </div>
              {/* Actions */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={handleSend}
                  >
                    <FaPaperPlane className="mr-2" />
                    Send Message
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={handleSaveDraft}
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={async () => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error('User not authenticated');
                        const { error } = await supabase
                          .from('email_templates')
                          .insert({
                            user_id: user.id,
                            name: subjectField || 'Untitled Template',
                            subject: subjectField,
                            content: messageBody,
                            created_at: new Date().toISOString()
                          });
                        if (error) throw error;
                        toast.success('Saved as template!');
                        // Refresh templates
                        const { data, error: fetchError } = await supabase
                          .from('email_templates')
                          .select('*')
                          .eq('user_id', user.id);
                        if (!fetchError && data) setTemplates(data);
                      } catch (err) {
                        console.error('Error saving template:', err);
                        toast.error(err.message || 'Failed to save template');
                      }
                    }}
                  >
                    Save as Template
                  </button>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={() => setShowSchedule(true)}
                  >
                    <FaClock className="mr-2" />
                    Schedule
                  </button>
                </div>
              </div>
            </form>
          ) : selectedMessage ? (
            <MessageView message={selectedMessage} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-lg">Select a message to view</div>
          )}
        </div>
      </section>
      {showSequenceBuilder && (
        <SequenceBuilderModal
          isOpen={showSequenceBuilder}
          onClose={()=>setShowSequenceBuilder(false)}
          initialSequence={editingSequence}
          onSaved={()=>{ setShowSequenceBuilder(false); }}
        />
      )}
    </div>
  );
} 