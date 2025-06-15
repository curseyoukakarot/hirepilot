import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    // Log email configuration (without sensitive data)
    console.log('Email service configuration:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      from: process.env.SMTP_FROM,
      hasAuth: !!process.env.SMTP_USER && !!process.env.SMTP_PASS,
    });

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('Missing email configuration');
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Log email attempt (without sensitive content)
    console.log('Attempting to send email to:', options.to);

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@hirepilot.ai',
      ...options,
    });

    console.log('Email sent successfully to:', options.to);
  } catch (err: any) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('Error sending email:', err);
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
}; 