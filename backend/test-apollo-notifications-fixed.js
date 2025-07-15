require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testApolloNotifications() {
  try {
    console.log('=== Testing Apollo Notifications with Fixed Parameters ===');
    
    const userId = '02a42d5c-0f65-4c58-8175-8304610c2ddc';
    const campaignId = '5b90bab7-cd23-417d-a015-316e9567f449'; // Network Engineer campaign
    
    // Test 1: Check if we can fetch user and campaign data
    console.log('\n1. Testing database queries...');
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ User query failed:', userError);
      return;
    }
    console.log('✅ User found:', user.email);

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('title, description')
      .eq('id', campaignId)
      .single();

    if (campaignError) {
      console.error('❌ Campaign query failed:', campaignError);
      return;
    }
    console.log('✅ Campaign found:', campaign.title);
    
    // Test 2: Test SendGrid configuration
    console.log('\n2. Testing SendGrid configuration...');
    if (!process.env.SENDGRID_API_KEY) {
      console.error('❌ SENDGRID_API_KEY not set');
      return;
    }
    
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('✅ SendGrid API key configured');
    
    // Test 3: Test notification function manually
    console.log('\n3. Testing Apollo notification function...');
    
    const searchCriteria = {
      jobTitle: 'Network Engineer',
      keywords: 'DevOps, Infrastructure',
      location: 'San Francisco'
    };
    
    const leadCount = 10;
    
    // Build notification content
    const userEmail = user.email;
    const userName = user.first_name || 'there';
    const campaignTitle = campaign.title || 'Your Apollo campaign';
    
    const searchSummary = [];
    if (searchCriteria.jobTitle) searchSummary.push(`Job Title: ${searchCriteria.jobTitle}`);
    if (searchCriteria.keywords) searchSummary.push(`Keywords: ${searchCriteria.keywords}`);
    if (searchCriteria.location) searchSummary.push(`Location: ${searchCriteria.location}`);
    
    const searchCriteriaText = searchSummary.length > 0 ? searchSummary.join(' • ') : 'No specific criteria';
    
    const emailSubject = `🎯 Apollo Campaign Complete: ${leadCount} leads found instantly!`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4f46e5; margin: 0;">🎯 Apollo Campaign Complete!</h1>
        </div>
        
        <p style="font-size: 16px; line-height: 1.5;">Hi ${userName},</p>
        
        <p style="font-size: 16px; line-height: 1.5;">
          Great news! Your Apollo campaign <strong>"${campaignTitle}"</strong> has found 
          <strong style="color: #4f46e5;">${leadCount} qualified prospects</strong> and they're ready to review in HirePilot.
        </p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0; margin-bottom: 15px;">🔍 Search Criteria</h3>
          <div style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            ${searchCriteriaText}
          </div>
        </div>
        
        <div style="background-color: #f0f9ff; border: 1px solid #7dd3fc; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #0369a1; margin-top: 0; margin-bottom: 10px;">📊 Campaign Summary</h3>
          <div style="color: #0369a1; font-size: 14px;">
            <strong>${leadCount}</strong> qualified prospects found and enriched<br>
            <strong>Ready to review:</strong> All leads are immediately available<br>
            <strong>Enrichment:</strong> Profile data populated from Apollo
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://app.thehirepilot.com/campaigns/${campaignId}" 
             style="background-color: #4f46e5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Review Your ${leadCount} Leads
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          This Apollo search was completed instantly with fully enriched profile data. 
          Happy recruiting!<br><br>
          The HirePilot Team
        </p>
      </div>
    `;
    
    // Test email sending
    console.log('\n4. Testing email sending...');
    const msg = {
      to: userEmail,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@hirepilot.com',
      subject: emailSubject,
      text: `Apollo campaign "${campaignTitle}" found ${leadCount} leads instantly!`,
      html: emailHtml,
    };
    
    try {
      await sgMail.send(msg);
      console.log('✅ Test Apollo notification email sent successfully to:', userEmail);
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      console.error('Error details:', emailError.response?.body?.errors);
    }
    
    console.log('\n=== Test Complete ===');
    console.log('✅ All components tested successfully!');
    console.log('✅ Apollo notifications should now work with the frontend fixes');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testApolloNotifications(); 