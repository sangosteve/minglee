// backend/src/utils/email.ts
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables explicitly
dotenv.config();

console.log('📧 Email utility initialized');
console.log('📧 Environment check:');
console.log('  SMTP_USER exists:', !!process.env.SMTP_USER);
console.log('  SMTP_PASS exists:', !!process.env.SMTP_PASS);
console.log('  SMTP_HOST:', process.env.SMTP_HOST || '(default: smtp.gmail.com)');
console.log('  SMTP_PORT:', process.env.SMTP_PORT || '(default: 587)');
console.log('  SMTP_SECURE:', process.env.SMTP_SECURE || '(default: false)');
console.log('  FRONTEND_URL:', process.env.FRONTEND_URL || '(default: http://localhost:8080)');

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  debug: true, // Enable debug output
  logger: true, // Enable logging
  tls: {
    // Do not fail on invalid certs
    rejectUnauthorized: false
  }
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP connection error:', error.message);

  } else {
    console.log('✅ SMTP server is ready to take messages');
  }
});

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
    contentType?: string;
  }>;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string; debug?: any }> {
  console.log('\n📧 sendEmail() called at:', new Date().toISOString());
  console.log('📧 Email details:');
  console.log('  To:', options.to);
  console.log('  Subject:', options.subject);
  console.log('  From:', options.from || '(default)');
  console.log('  Has HTML:', !!options.html);
  console.log('  Has Text:', !!options.text);
  
  try {
    // Check if SMTP is configured
    const hasSmtpConfig = !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
    console.log('📧 SMTP configuration check:');
    console.log('  SMTP_USER provided:', !!process.env.SMTP_USER);
    console.log('  SMTP_PASS provided:', !!process.env.SMTP_PASS);
    console.log('  SMTP fully configured:', hasSmtpConfig);

    if (!hasSmtpConfig) {
      console.log('⚠️ SMTP not fully configured. Email will be logged only.');
      console.log('📧 Would send email:');
      console.log('  To:', options.to);
      console.log('  Subject:', options.subject);
      console.log('  HTML preview:', options.html.substring(0, 200).replace(/\n/g, ' ') + '...');
      
      if (options.text) {
        console.log('  Text preview:', options.text.substring(0, 200) + '...');
      }
      
      // Return simulated success for development
      return { 
        success: true, 
        messageId: 'simulated-' + Date.now(),
        debug: { simulated: true, reason: 'SMTP not configured' }
      };
    }

    console.log('✅ SMTP credentials found, preparing to send email...');
    
    const mailOptions = {
      from: options.from || process.env.SMTP_FROM || `Minglee <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      cc: options.cc,
      bcc: options.bcc,
      attachments: options.attachments,
    };

    console.log('📤 Mail options prepared:');
    console.log('  From:', mailOptions.from);
    console.log('  To:', mailOptions.to);
    console.log('  Subject:', mailOptions.subject);
    console.log('  Text length:', mailOptions.text?.length || 0);
    console.log('  HTML length:', mailOptions.html?.length || 0);

    console.log('🚀 Attempting to send email via SMTP...');
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully!');
    console.log('  Message ID:', info.messageId);
    console.log('  Response:', info.response);
    console.log('  Envelope:', info.envelope);
    
    return { 
      success: true, 
      messageId: info.messageId,
      debug: {
        envelope: info.envelope,
        response: info.response
      }
    };
    
  } catch (error: any) {
    console.error('❌ Failed to send email:');
    console.error('  Error name:', error.name);
    console.error('  Error message:', error.message);
    console.error('  Error code:', error.code);
    console.error('  Error command:', error.command);
    
    if (error.response) {
      console.error('  SMTP response:', error.response);
    }
    
    if (error.responseCode) {
      console.error('  Response code:', error.responseCode);
    }
    
    // Detailed troubleshooting
    if (error.code === 'EAUTH') {
      console.error('\n🔑 Authentication failed. Possible issues:');
      console.error('  1. Wrong username/password');
      console.error('  2. 2FA not enabled on Gmail account');
      console.error('  3. Using regular password instead of app password');
      console.error('  4. App password revoked or regenerated');
    } else if (error.code === 'ECONNECTION') {
      console.error('\n🌐 Connection failed. Possible issues:');
      console.error('  1. Wrong SMTP host/port');
      console.error('  2. Firewall blocking connection');
      console.error('  3. Network issues');
      console.error('  4. Gmail blocking connection (try enabling less secure apps)');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n⏰ Connection timeout. Possible issues:');
      console.error('  1. Network is slow');
      console.error('  2. SMTP server is down');
      console.error('  3. Port is blocked');
    }
    
    return { 
      success: false, 
      error: error.message,
      debug: {
        name: error.name,
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
        response: error.response
      }
    };
  }
}

// Helper function to strip HTML tags for plain text version
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();
}

// Helper function for team invitations
export async function sendTeamInvitationEmail(
  to: string,
  teamName: string,
  invitationToken: string,
  role: string,
  expiresAt: Date,
  inviterName?: string
): Promise<{ success: boolean; messageId?: string; error?: string; debug?: any }> {
  console.log('\n📧 sendTeamInvitationEmail() called:');
  console.log('  To:', to);
  console.log('  Team:', teamName);
  console.log('  Role:', role);
  console.log('  Expires:', expiresAt.toISOString());
  console.log('  Inviter:', inviterName || '(not specified)');
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const invitationLink = `${frontendUrl}/teams/invitation/${invitationToken}`;
  const expiresDate = expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  console.log('  Invitation link:', invitationLink);
  console.log('  Expires date (formatted):', expiresDate);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Team Invitation - Minglee</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9fafb;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .header {
          text-align: center;
          padding-bottom: 30px;
          border-bottom: 2px solid #f1f5f9;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #3B82F6;
          text-decoration: none;
          margin-bottom: 10px;
          display: inline-block;
        }
        .tagline {
          color: #64748b;
          font-size: 16px;
          margin-top: 5px;
        }
        .content {
          padding: 30px 0;
        }
        .invitation-card {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 10px;
          padding: 25px;
          margin: 25px 0;
          border-left: 4px solid #3B82F6;
        }
        .invitation-card p {
          margin: 10px 0;
          color: #475569;
        }
        .invitation-card strong {
          color: #1e293b;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #3B82F6 0%, #2563eb 100%);
          color: white;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
        }
        .warning {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          color: #dc2626;
          font-size: 14px;
        }
        .warning strong {
          display: block;
          margin-bottom: 5px;
        }
        .footer {
          text-align: center;
          padding-top: 30px;
          border-top: 2px solid #f1f5f9;
          color: #64748b;
          font-size: 14px;
        }
        .link {
          color: #3B82F6;
          word-break: break-all;
          display: block;
          margin-top: 10px;
          text-decoration: none;
        }
        .link:hover {
          text-decoration: underline;
        }
        .role-badge {
          display: inline-block;
          background: #dbeafe;
          color: #1e40af;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
          margin-left: 5px;
        }
        @media (max-width: 640px) {
          .container {
            padding: 20px;
          }
          .content {
            padding: 20px 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Minglee</div>
          <div class="tagline">Team Collaboration Platform</div>
        </div>
        
        <div class="content">
          <h2 style="color: #1e293b; margin-bottom: 20px;">Team Invitation</h2>
          
          <p style="color: #475569; margin-bottom: 20px;">
            You've been invited to join the team <strong style="color: #1e293b;">${teamName}</strong> on Minglee.
          </p>
          
          ${inviterName ? `
          <p style="color: #475569; margin-bottom: 20px;">
            Invited by: <strong style="color: #1e293b;">${inviterName}</strong>
          </p>
          ` : ''}
          
          <div class="invitation-card">
            <p><strong>Team:</strong> ${teamName}</p>
            <p><strong>Your Role:</strong> ${role} <span class="role-badge">${role.toUpperCase()}</span></p>
            <p><strong>Invitation Expires:</strong> ${expiresDate}</p>
          </div>
          
          <p style="color: #475569; margin-bottom: 20px;">
            Click the button below to accept this invitation:
          </p>
          
          <div class="button-container">
            <a href="${invitationLink}" class="button">Accept Invitation</a>
          </div>
          
          <div class="warning">
            <strong>Important:</strong>
            This invitation will expire on ${expiresDate}. If you don't accept by then, you'll need to request a new invitation.
          </div>
          
          <p style="color: #475569; margin-bottom: 20px;">
            If the button doesn't work, copy and paste this link into your browser:
            <a href="${invitationLink}" class="link">${invitationLink}</a>
          </p>
          
          <p style="color: #94a3b8; font-size: 14px; margin-top: 30px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
        
        <div class="footer">
          <p style="margin-bottom: 10px;">© ${new Date().getFullYear()} Minglee. All rights reserved.</p>
          <p style="margin-bottom: 5px; font-size: 12px;">This email was sent to ${to}</p>
          <p style="font-size: 12px; color: #94a3b8;">Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
TEAM INVITATION - MINGLEE

You've been invited to join the team "${teamName}" on Minglee.

${inviterName ? `Invited by: ${inviterName}` : ''}

Team: ${teamName}
Your Role: ${role}
Invitation Expires: ${expiresDate}

Accept your invitation by visiting:
${invitationLink}

Important: This invitation will expire on ${expiresDate}. 
If you don't accept by then, you'll need to request a new invitation.

If the link above doesn't work, copy and paste it into your browser.

If you didn't expect this invitation, you can safely ignore this email.

---
© ${new Date().getFullYear()} Minglee. All rights reserved.
This email was sent to ${to}. Please do not reply to this email.
  `.trim();

  console.log('📧 Calling sendEmail() with invitation email...');
  const result = await sendEmail({
    to,
    subject: `Invitation to join ${teamName} on Minglee`,
    html,
    text,
  });

  console.log('📧 sendTeamInvitationEmail() result:', {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  });

  return result;
}

// Simple test function you can call from anywhere
export async function testEmailSending(): Promise<void> {
  console.log('\n🧪 Testing email sending...');
  
  const testEmail = process.env.SMTP_USER || 'test@example.com';
  console.log('  Test email address:', testEmail);
  
  const result = await sendEmail({
    to: testEmail,
    subject: 'Test Email from Minglee Backend',
    html: '<h1>Test Email</h1><p>This is a test email to verify email functionality is working.</p><p>Sent at: ' + new Date().toISOString() + '</p>',
    text: 'Test Email from Minglee Backend\nThis is a test email to verify email functionality is working.\nSent at: ' + new Date().toISOString(),
  });
  
  console.log('🧪 Test result:', {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  });
  
  if (result.success) {
    console.log('✅ Email test passed!');
  } else {
    console.log('❌ Email test failed:', result.error);
  }
}