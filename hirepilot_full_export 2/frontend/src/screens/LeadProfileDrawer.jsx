// LeadProfileDrawer.jsx (with GPT + SendGrid integration placeholders)
import React, { useState } from 'react';
import {
  FaPenToSquare,
  FaXmark,
  FaPaperPlane,
  FaArrowRightToBracket,
  FaLinkedin,
  FaBuilding,
  FaEnvelope,
  FaPhone,
  FaTwitter
} from 'react-icons/fa6';

export default function LeadProfileDrawer({ lead, onClose }) {
  const [notes, setNotes] = useState(lead?.notes || '');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState("Hi Alex, I noticed your great work at Google and wanted to reach out about a role we’re hiring for...");
  const [loadingGPT, setLoadingGPT] = useState(false);

  const rewriteWithGPT = async () => {
    setLoadingGPT(true);
    try {
      const prompt = `Rewrite this message for ${lead.name}, a ${lead.title}, in a friendly tone:\n\n"${messageText}"`;
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer YOUR_OPENAI_API_KEY`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const newMessage = data.choices?.[0]?.message?.content;
      if (newMessage) setMessageText(newMessage.trim());
    } catch (err) {
      alert("Failed to fetch GPT message.");
      console.error(err);
    } finally {
      setLoadingGPT(false);
    }
  };

  const sendWithSendGrid = async () => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lead.email,
          subject: `Follow-up Opportunity for ${lead.name}`,
          text: messageText,
        }),
      });
      alert("Message sent successfully!");
      setShowMessageModal(false);
    } catch (err) {
      alert("Failed to send message.");
      console.error(err);
    }
  };

  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="bg-white w-[768px] h-full shadow-xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src={lead.avatar} alt="Profile" className="w-12 h-12 rounded-full" />
            <div>
              <h2 className="text-xl font-semibold">{lead.name}</h2>
              <p className="text-gray-600">{lead.title}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button className="text-gray-400 hover:text-gray-500">
              <FaPenToSquare className="text-lg" />
            </button>
            <button className="text-gray-400 hover:text-gray-500" onClick={onClose}>
              <FaXmark className="text-lg" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex space-x-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center"
            onClick={() => setShowMessageModal(true)}
          >
            <FaPaperPlane className="mr-2" /> Message Again
          </button>
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center">
            <FaArrowRightToBracket className="mr-2" /> Move to Campaign
          </button>
        </div>

        <div className="px-6 py-6 overflow-y-auto flex-1 space-y-8">
          {/* Notes Section */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Private Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write notes about this lead..."
              className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg shadow-sm text-sm text-gray-700"
            />
            <div className="mt-3 text-right">
              <button
                onClick={() => alert('Notes saved (mock)!')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>

        {/* Message Again Modal */}
        {showMessageModal && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
            <div className="bg-white w-full max-w-lg rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Resend Message</h3>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full min-h-[140px] border border-gray-300 rounded-lg p-3 text-sm"
              />
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={rewriteWithGPT}
                  className="text-sm text-blue-600 hover:underline"
                  disabled={loadingGPT}
                >
                  {loadingGPT ? 'Rewriting...' : 'Rewrite with GPT'}
                </button>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowMessageModal(false)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendWithSendGrid}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Send Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
