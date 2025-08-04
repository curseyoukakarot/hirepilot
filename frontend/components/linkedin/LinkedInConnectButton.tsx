import React, { useState } from 'react';
import { Loader2, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface LinkedInConnectButtonProps {
  linkedin_url: string;
  defaultMessage?: string;
  leadId?: string;
  campaignId?: string;
  disabled?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface ConnectResponse {
  success: boolean;
  message: string;
  workflow_id?: string;
  estimated_completion?: string;
  status?: string;
  error?: string;
  action_required?: string;
  redirect_url?: string;
}

export const LinkedInConnectButton: React.FC<LinkedInConnectButtonProps> = ({
  linkedin_url,
  defaultMessage = "Hi! I'd love to connect with you and explore potential collaboration opportunities.",
  leadId,
  campaignId,
  disabled = false,
  onSuccess,
  onError,
  className = ''
}) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState(defaultMessage);
  const [showCustomMessage, setShowCustomMessage] = useState(false);

  const handleSendConnect = async () => {
    if (!linkedin_url) {
      toast.error('LinkedIn profile URL is required');
      return;
    }

    if (!message.trim()) {
      toast.error('Connection message is required');
      return;
    }

    if (message.length > 300) {
      toast.error('Message must be 300 characters or less');
      return;
    }

    setLoading(true);
    setStatus('sending');

    try {
      const response = await fetch('/api/linkedin/send-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}` // Adjust based on your auth
        },
        body: JSON.stringify({
          linkedin_url,
          message: message.trim(),
          lead_id: leadId,
          campaign_id: campaignId
        })
      });

      const data: ConnectResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send connection request');
      }

      if (data.success) {
        setStatus('success');
        toast.success(data.message || 'LinkedIn connection request queued successfully!');
        
        // Show additional info about automation
        if (data.estimated_completion) {
          toast.success(`Automation will complete in ${data.estimated_completion}`, {
            duration: 5000
          });
        }

        onSuccess?.(data);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }

    } catch (error: any) {
      setStatus('error');
      console.error('LinkedIn Connect Error:', error);

      // Handle specific error cases
      if (error.message.includes('LinkedIn authentication required')) {
        toast.error('Please refresh your LinkedIn session in Settings', {
          duration: 8000
        });
      } else if (error.message.includes('Sales Navigator URLs are not supported')) {
        toast.error('This profile has a Sales Navigator URL which cannot be used for connection requests. Please use a regular LinkedIn profile URL.', {
          duration: 8000
        });
      } else if (error.message.includes('Daily connection limit')) {
        toast.error('Daily LinkedIn connection limit reached. Try again tomorrow.', {
          duration: 6000
        });
      } else {
        toast.error(error.message || 'Failed to send connection request');
      }

      onError?.(error.message);
      
      // Reset status after error
      setTimeout(() => setStatus('idle'), 3000);
    } finally {
      setLoading(false);
    }
  };

  const getButtonIcon = () => {
    switch (status) {
      case 'sending':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Send className="h-4 w-4" />;
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'sending':
        return 'Sending...';
      case 'success':
        return 'Sent!';
      case 'error':
        return 'Try Again';
      default:
        return 'Send Connect';
    }
  };



  return (
    <div className={`space-y-3 ${className}`}>
      {/* Custom Message Toggle */}
      {!showCustomMessage && (
        <div className="text-sm text-gray-600">
          <span>Default message will be used. </span>
          <button
            type="button"
            onClick={() => setShowCustomMessage(true)}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Customize message
          </button>
        </div>
      )}

      {/* Custom Message Input */}
      {showCustomMessage && (
        <div className="space-y-2">
          <label htmlFor="connect-message" className="text-sm font-medium text-gray-700">
            Connection Message
          </label>
          <textarea
            id="connect-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your connection message..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
            maxLength={300}
            disabled={loading}
          />
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>{message.length}/300 characters</span>
            {showCustomMessage && (
              <button
                type="button"
                onClick={() => {
                  setShowCustomMessage(false);
                  setMessage(defaultMessage);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                Use default message
              </button>
            )}
          </div>
        </div>
      )}

      {/* Send Button */}
      <button
        onClick={handleSendConnect}
        disabled={disabled || loading || status === 'success'}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
          status === 'success' 
            ? 'bg-green-600 text-white' 
            : status === 'error'
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {getButtonIcon()}
        {getButtonText()}
      </button>

      {/* Status Messages */}
      {status === 'success' && (
        <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
          <div className="font-medium">✅ Connection request queued successfully!</div>
          <div className="mt-1">The automation will process this request within 30-60 seconds.</div>
        </div>
      )}

      {status === 'sending' && (
        <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-md">
          <div className="font-medium">🤖 Automating LinkedIn connection...</div>
          <div className="mt-1">Please wait while we process your request.</div>
        </div>
      )}

      {/* LinkedIn Profile Link */}
      <div className="text-xs text-gray-500">
        <span>Target: </span>
        <a 
          href={linkedin_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {linkedin_url.replace('https://www.linkedin.com/in/', '').replace('/', '')}
        </a>
      </div>
    </div>
  );
};

export default LinkedInConnectButton;