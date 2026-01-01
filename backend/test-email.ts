// backend/test-email.ts
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
  console.log('Testing email configuration...');
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS length:', process.env.SMTP_PASS?.length || 'Not set');
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    // Send test email
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `Test <${process.env.SMTP_USER}>`,
      to:'stevesango4@gmail.com', // Send to yourself
      subject: 'Test Email from Minglee Backend',
      text: 'This is a test email to verify your SMTP configuration is working!',
      html: '<h1>Test Email</h1><p>This is a test email to verify your SMTP configuration is working!</p>',
    });
    
    console.log('✅ Test email sent! Message ID:', info.messageId);
    console.log('📧 Check your inbox for the test email.');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    // Common error troubleshooting
    if (error.code === 'EAUTH') {
      console.log('\n🔑 Authentication failed. Common issues:');
      console.log('1. Make sure 2FA is enabled on your Google account');
      console.log('2. Verify you copied the app password correctly (16 characters, no spaces)');
      console.log('3. Try generating a new app password');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n🌐 Connection refused. Check:');
      console.log('1. Are you using the correct SMTP_HOST (smtp.gmail.com)');
      console.log('2. Are you using the correct SMTP_PORT (587)');
      console.log('3. Is your firewall blocking the connection?');
    }
  }
}

testEmail();