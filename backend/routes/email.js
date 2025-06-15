// Add tracking data to email
const addTrackingData = (msg, userId, campaignId, leadId) => {
  msg.customArgs = {
    user_id: userId,
    campaign_id: campaignId,
    lead_id: leadId
  };
  msg.trackingSettings = {
    clickTracking: { enable: true },
    openTracking: { enable: true }
  };
  return msg;
};

// Update the sendEmail function
router.post('/send', async (req, res) => {
  try {
    const { to, subject, text, html, campaignId, leadId } = req.body;
    const userId = req.user.id;

    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      text,
      html
    };

    // Add tracking data
    const msgWithTracking = addTrackingData(msg, userId, campaignId, leadId);

    await sgMail.send(msgWithTracking);
    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
}); 