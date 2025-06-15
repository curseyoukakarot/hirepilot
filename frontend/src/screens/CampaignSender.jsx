import React, { useState } from 'react';
import TemplateSelector from '../components/TemplateSelector';
import { apiGet, apiPost } from '../lib/api';

function CampaignSender({ userId, selectedLeadIds }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customContent, setCustomContent] = useState('');

  // Helper function to replace dynamic tokens in the message content
  const replaceTokens = (content, leadData) => {
    return content.replace(/{{(\w+)}}/g, (match, token) => {
      return leadData[token] || match;
    });
  };

  const handleSend = async () => {
    // Fetch lead data for each selected lead ID
    const leadDataPromises = selectedLeadIds.map(async (leadId) => {
      const data = await apiGet(`/api/getLeadData?lead_id=${leadId}`);
      return data;
    });
    const leadDataArray = await Promise.all(leadDataPromises);

    // Prepare messages with replaced tokens
    const messages = leadDataArray.map(leadData => ({
      lead_id: leadData.id,
      content: replaceTokens(customContent, leadData)
    }));

    const result = await apiPost('/api/sendMassMessage', {
      lead_ids: selectedLeadIds,
      template_id: selectedTemplate?.id,
      messages,
      channel: 'email',
    });

    alert(`Sent: ${result.sent}, Failed: ${result.failed}`);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Campaign Sender</h2>
      <TemplateSelector userId={userId} onSelect={setSelectedTemplate} />
      <textarea
        className="border p-2 rounded w-full mt-2"
        rows={4}
        placeholder="Custom content (optional). Use {{first_name}}, {{company}}, etc. for dynamic tokens."
        value={customContent}
        onChange={(e) => setCustomContent(e.target.value)}
      />
      <button
        className="bg-green-500 text-white px-4 py-2 rounded mt-4"
        onClick={handleSend}
      >
        Send to {selectedLeadIds.length} leads
      </button>
    </div>
  );
}

export default CampaignSender;
