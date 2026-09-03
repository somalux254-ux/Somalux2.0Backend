import nodemailer from 'nodemailer';

const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM,
  EMAIL_LOGO_URL,
} = process.env;

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST || 'smtp.gmail.com',
  port: EMAIL_PORT ? Number(EMAIL_PORT) : 587,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// Test email configuration on startup
(async () => {
  try {
    console.log('📧 [EMAIL CONFIG] Testing email configuration...');
    console.log('📧 [EMAIL CONFIG] Host:', EMAIL_HOST || 'smtp.gmail.com');
    console.log('📧 [EMAIL CONFIG] Port:', EMAIL_PORT ? Number(EMAIL_PORT) : 587);
    console.log('📧 [EMAIL CONFIG] User:', EMAIL_USER ? EMAIL_USER : 'NOT SET');
    console.log('📧 [EMAIL CONFIG] Pass:', EMAIL_PASS ? '***SET***' : 'NOT SET');
    
    if (EMAIL_USER && EMAIL_PASS) {
      await transporter.verify();
      console.log('✅ [EMAIL CONFIG] Email server connection verified successfully!');
    } else {
      console.warn('⚠️ [EMAIL CONFIG] Email credentials not configured. Email sending will fail.');
    }
  } catch (error) {
    console.error('❌ [EMAIL CONFIG] Email server connection failed:', error.message);
    console.error('❌ [EMAIL CONFIG] Please check your email configuration in .env file');
  }
})();

export function buildBrandedEmailHtml({ title, body }) {
  const safeTitle = title || 'Somalux';
  const safeBody = body || '';
  const logoUrl = EMAIL_LOGO_URL || '';

  // If caller passes a ready-made HTML block (starts with '<'), inject it
  // directly. Otherwise, convert plain text/newlines into paragraph tags.
  const isRawHtml = typeof safeBody === 'string' && safeBody.trim().startsWith('<');
  const bodyHtml = isRawHtml
    ? safeBody
    : safeBody
        .split('\n')
        .map((line) => `<p style="margin: 0 0 12px; color: #333333; font-size: 14px; line-height: 1.6;">${line}</p>`)
        .join('');

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${safeTitle}</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f4f5fb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f5fb; padding:24px 0;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(15,23,42,0.08);">
              <tr>
                <td style="background:linear-gradient(135deg,#0f172a,#1e293b); padding:20px 24px; text-align:left;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="vertical-align:middle;">
                        ${logoUrl
                          ? `<img src="${logoUrl}" alt="Paltech Somalux" style="max-height:40px; display:block;" />`
                          : `<span style="color:#e5e7eb; font-size:18px; font-weight:600;">Paltech Somalux</span>`}
                      </td>
                      <td style="vertical-align:middle; text-align:right;">
                        <span style="color:#9ca3af; font-size:11px; letter-spacing:0.12em; text-transform:uppercase;">Paltech Somalux Update</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 24px 8px;">
                  <h1 style="margin:0 0 12px; font-size:20px; line-height:1.3; color:#111827;">${safeTitle}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 24px;">
                  ${bodyHtml}
                  <p style="margin:24px 0 8px; color:#6b7280; font-size:13px;">Warm regards,</p>
                  <p style="margin:0 0 4px; color:#111827; font-size:14px; font-weight:600;">Somalux</p>
                  <p style="margin:0; color:#9ca3af; font-size:12px;">Your knowledge platform</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px 20px; border-top:1px solid #e5e7eb; background-color:#f9fafb;">
                  <p style="margin:0 0 4px; color:#9ca3af; font-size:11px;">You received this email because you are connected with Somalux.</p>
                  <p style="margin:0; color:#d1d5db; font-size:10px;">&copy; ${new Date().getFullYear()} Somalux. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

export async function sendEmail({ to, subject, text, html }) {
  console.log('📧 [EMAIL UTILITY] sendEmail called');
  console.log('📧 [EMAIL UTILITY] To:', to);
  console.log('📧 [EMAIL UTILITY] Subject:', subject);
  
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('❌ [EMAIL UTILITY] Email credentials not configured!');
    console.error('❌ [EMAIL UTILITY] EMAIL_USER:', EMAIL_USER ? 'SET' : 'NOT SET');
    console.error('❌ [EMAIL UTILITY] EMAIL_PASS:', EMAIL_PASS ? 'SET' : 'NOT SET');
    throw new Error('Email is not configured on the server (missing EMAIL_USER/EMAIL_PASS).');
  }

  const from = EMAIL_FROM || EMAIL_USER;
  console.log('📧 [EMAIL UTILITY] From:', from);
  console.log('📧 [EMAIL UTILITY] Attempting to send email via SMTP...');

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    console.log('✅ [EMAIL UTILITY] Email sent successfully!');
    console.log('✅ [EMAIL UTILITY] Message ID:', info.messageId);
    console.log('✅ [EMAIL UTILITY] Response:', info.response);
    return info;
  } catch (error) {
    console.error('❌ [EMAIL UTILITY] Failed to send email!');
    console.error('❌ [EMAIL UTILITY] Error:', error.message);
    console.error('❌ [EMAIL UTILITY] Error details:', error);
    throw error;
  }
}

/**
 * Send quota approval email to landlord
 * @deprecated - Rental features removed
 */
export async function sendQuotaApprovalEmail() {
  throw new Error('Rental features have been removed from the system');
}

/**
 * Send quota rejection email to landlord
 * @deprecated - Rental features removed
 */
export async function sendQuotaRejectionEmail() {
  throw new Error('Rental features have been removed from the system');
}

/**
 * Send listing approval email to landlord
 * @deprecated - Rental features removed
 */
export async function sendListingApprovalEmail() {
  throw new Error('Rental features have been removed from the system');
}

/**
 * Send listing rejection email to landlord
 * @deprecated - Rental features removed
 */
export async function sendListingRejectionEmail() {
  throw new Error('Rental features have been removed from the system');
}

/**
 * Send booking approval email to student
 * @deprecated - Rental features removed
 */
export async function sendBookingApprovalEmail() {
  throw new Error('Rental features have been removed from the system');
}

/**
 * Send booking rejection email to student
 * @deprecated - Rental features removed
 */
export async function sendBookingRejectionEmail() {
  throw new Error('Rental features have been removed from the system');
}

/**
 * Send new booking request email to landlord
 * @deprecated - Rental features removed
 */
export async function sendNewBookingRequestEmail() {
  throw new Error('Rental features have been removed from the system');
}
