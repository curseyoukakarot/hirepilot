import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  ArrowLeft,
  ArrowRight,
  X,
  Wand2,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
  Code2,
  ChevronDown,
  Save,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import WizardStepHeader from './WizardStepHeader';
import { useWizard } from '../../context/WizardContext';

const toneOptions = ['Professional', 'Friendly', 'Bold'];
const tokenOptions = [
  { label: 'First Name', value: '{{first_name}}' },
  { label: 'Job Title', value: '{{job_title}}' },
  { label: 'Company', value: '{{company}}' },
];

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function Step3Message({ onBack, onNext }) {
  const { wizard, setWizard } = useWizard();
  const message = wizard.message || '';

  // Debug
  console.log('Step3Message render:', { message });

  // Example: when updating the message
  const handleMessageChange = (newMessage) => {
    setWizard(prev => ({ ...prev, message: newMessage }));
  };

  const [subject, setSubject] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [setDefault, setSetDefault] = useState(false);
  const [tone, setTone] = useState(toneOptions[0]);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);

  // Handle editor input
  const handleEditorInput = (e) => {
    handleMessageChange(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  // Restore cursor position after update
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.selectionStart = cursorPosition;
      textareaRef.current.selectionEnd = cursorPosition;
    }
  }, [message, cursorPosition]);

  // Insert token at cursor position
  const insertToken = (token) => {
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newText = message.substring(0, start) + token + message.substring(end);
    
    handleMessageChange(newText);
    setCursorPosition(start + token.length);
    setShowTokenDropdown(false);
  };

  // AI Generation with GPT
  const handleGenerateAI = async () => {
    if (!subject.trim()) {
      alert('Please enter a subject line first');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/generate-message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are an expert recruiter writing a concise, upfront outreach message to a potential candidate.
                The message should be 4-6 sentences max and should feel human, not corporate.
                
                Follow these rules:
                1. Write a casual subject line (like: "Quick chat?" or "Your background caught my eye")
                2. Use a direct greeting with the candidate's first name
                3. Start with an honest opener stating that you're helping [job title] at [company/industry] hire a [target role]
                4. Include a 1-line connection to the candidate's background - use actual skills, technologies, or experience mentioned in the job description
                5. End with a simple call-to-action asking for a quick 5-10 minute call
                
                Keep the tone straightforward, slightly informal, and avoid corporate jargon. No fluff or fancy intros.
                
                IMPORTANT: When referencing the candidate's background or skills, use actual content from the job description.
                DO NOT use placeholder text like "specific area" or "relevant experience".
                Extract and use real skills, technologies, or requirements mentioned in the job description.`
            },
            {
              role: "user",
              content: `Write a concise outreach message using this job description and context:
                Subject: ${subject}
                Job Description: ${message}
                
                The message should be personalized and reference specific details from the job description.
                Include appropriate tokens like {{first_name}}, {{job_title}}, and {{company}} where relevant.
                
                IMPORTANT: When mentioning the candidate's background or skills, use actual content from the job description above.
                For example, if the job description mentions "React, TypeScript, and AWS", reference those specific technologies.
                Do not use placeholder text or generic references.`
            }
          ],
          model: "gpt-4",
          temperature: 0.7,
          max_tokens: 500
        }),
      });
      
      const data = await response.json();
      if (response.ok && data.choices && data.choices[0]) {
        const generatedMessage = data.choices[0].message.content;
        handleMessageChange(generatedMessage);
      } else {
        throw new Error(data.error?.message || 'Failed to generate message');
      }
    } catch (err) {
      console.error('Error generating message:', err);
      // Fallback to mock data
      const fallbackMessage = `Hi {{first_name}},

I'm helping a Head of Engineering at a fast-growing tech company hire a {{job_title}}, and your background caught my eye.

Your experience with React and TypeScript at {{company}} aligns perfectly with what we're looking for.

Would you be open to a quick 5-minute call this week to discuss if there's mutual interest?`;

      handleMessageChange(fallbackMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Toolbar actions
  const handleToolbar = (action) => {
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = message.substring(start, end);
    let newText = message;
    
    switch(action) {
      case 'bold':
        newText = message.substring(0, start) + `**${selectedText}**` + message.substring(end);
        break;
      case 'italic':
        newText = message.substring(0, start) + `*${selectedText}*` + message.substring(end);
        break;
      case 'list':
        newText = message.substring(0, start) + `\n- ${selectedText}` + message.substring(end);
        break;
      case 'link':
        const url = prompt('Enter URL:');
        if (url) {
          newText = message.substring(0, start) + `[${selectedText}](${url})` + message.substring(end);
        }
        break;
    }
    
    handleMessageChange(newText);
    setCursorPosition(start + (newText.length - message.length));
  };

  // Handle saving template
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await fetch(`${API_BASE_URL}/saveMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          name: templateName,
          subject,
          message,
          tone,
          is_default: setDefault
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save template');
      }

      // Close modal and reset form
      setShowTemplateModal(false);
      setTemplateName('');
      setSetDefault(false);
    } catch (err) {
      console.error('Error saving template:', err);
      alert(err.message || 'Failed to save template. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = subject.trim().length > 0 && message.trim().length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <WizardStepHeader currentStep={3} />
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          {/* Subject Line */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line</label>
            <input
              type="text"
              placeholder="e.g. Exciting Frontend Role at a Fast-Growing Startup 🚀"
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>
          {/* AI Generation */}
          <div className="mb-6">
            <button
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-lg flex items-center justify-center hover:from-purple-600 hover:to-blue-600 transition-all"
              onClick={handleGenerateAI}
              disabled={isGenerating}
            >
              <Wand2 className="mr-2" />
              {isGenerating ? 'Generating...' : 'Generate Message with AI'}
            </button>
            <p className="text-sm text-gray-500 mt-2 text-center">Uses your job description and keywords to draft a first-pass outreach message.</p>
          </div>
          {/* Message Editor */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Message Body</label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Toolbar */}
              <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center space-x-2">
                <button className="p-2 hover:bg-gray-200 rounded" type="button" onClick={() => handleToolbar('bold')}><Bold /></button>
                <button className="p-2 hover:bg-gray-200 rounded" type="button" onClick={() => handleToolbar('italic')}><Italic /></button>
                <button className="p-2 hover:bg-gray-200 rounded" type="button" onClick={() => handleToolbar('list')}><List /></button>
                <button className="p-2 hover:bg-gray-200 rounded" type="button" onClick={() => handleToolbar('link')}><LinkIcon /></button>
                <div className="h-6 w-px bg-gray-300"></div>
                <div className="relative">
                  <button
                    className="flex items-center space-x-2 px-3 py-1.5 rounded hover:bg-gray-200"
                    type="button"
                    onClick={() => setShowTokenDropdown(v => !v)}
                  >
                    <Code2 />
                    <span>Insert Token</span>
                    <ChevronDown className="text-xs w-4 h-4" />
                  </button>
                  {showTokenDropdown && (
                    <div className="absolute left-0 mt-2 w-40 bg-white border border-gray-200 rounded shadow z-10">
                      {tokenOptions.map(t => (
                        <button
                          key={t.value}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                          type="button"
                          onClick={() => insertToken(t.value)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="ml-auto">
                  <select
                    className="text-sm border border-gray-300 rounded px-2 py-1.5"
                    value={tone}
                    onChange={e => setTone(e.target.value)}
                  >
                    {toneOptions.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Editor Area */}
              <textarea
                ref={textareaRef}
                className="w-full min-h-[200px] p-4 outline-none resize-none"
                value={message}
                onChange={handleEditorInput}
                placeholder="Write your message here..."
              />
            </div>
          </div>
          {/* Template Save */}
          <div className="flex items-center justify-between">
            <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-800" type="button" onClick={() => setShowTemplateModal(true)}>
              <FileText className="w-4 h-4" />
              <span>Save as Template</span>
            </button>
            <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-800" type="button" onClick={handleGenerateAI}>
              <RotateCcw className="w-4 h-4" />
              <span>Try Another Version</span>
            </button>
          </div>
        </div>
        {/* Navigation */}
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t z-50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <button 
                className="flex items-center text-gray-600 hover:text-gray-900" 
                onClick={onBack}
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Back to Pipeline
              </button>
              <button 
                className={`bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                  !canProceed ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={onNext}
                disabled={!canProceed}
              >
                Next: Add Leads
                <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </div>
          </div>
        </footer>
      </main>
      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Save as Template</h3>
              <button 
                className="text-gray-400 hover:text-gray-600" 
                onClick={() => setShowTemplateModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Frontend Outreach v1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                />
              </div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-500"
                  checked={setDefault}
                  onChange={e => setSetDefault(e.target.checked)}
                />
                <span className="text-sm text-gray-700">Set as default for this campaign</span>
              </label>
              <button 
                className={`w-full py-2 rounded-lg ${
                  isSaving 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
                onClick={handleSaveTemplate}
                disabled={isSaving || !templateName.trim()}
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 