import { sendEmail, buildBrandedEmailHtml } from '../utils/email.js';
import { createClient } from '@supabase/supabase-js';

// Lazy-initialize Supabase client (only when needed)
let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ [ADMIN FETCH] Supabase credentials not configured. Using .env fallback only.');
      return null;
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

/**
 * Fetch all admin emails dynamically from the database
 */
export async function getAdminEmails() {
  try {
    const client = getSupabaseClient();
    
    if (!client) {
      console.warn('⚠️ [ADMIN FETCH] Supabase client not available, using .env fallback');
      return getFallbackAdminEmails();
    }

    console.log('🔍 [ADMIN FETCH] Fetching admin emails from database...');
    
    const { data: admins, error } = await client
      .from('profiles')
      .select('email')
      .eq('role', 'admin');

    if (error) {
      console.error('❌ [ADMIN FETCH] Database error:', error.message);
      // Fall back to environment variable
      return getFallbackAdminEmails();
    }

    if (!admins || admins.length === 0) {
      console.warn('⚠️ [ADMIN FETCH] No admins found in database');
      return getFallbackAdminEmails();
    }

    const adminEmails = admins
      .map(admin => admin.email)
      .filter(email => email && email.trim().length > 0);

    console.log(`✅ [ADMIN FETCH] Found ${adminEmails.length} admin(s) in database`);
    return adminEmails;
  } catch (err) {
    console.error('❌ [ADMIN FETCH] Unexpected error:', err.message);
    return getFallbackAdminEmails();
  }
}

/**
 * Get fallback admin emails from environment variable
 */
function getFallbackAdminEmails() {
  const adminEmailsEnv = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsEnv
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0);

  if (adminEmails.length > 0) {
    console.log(`✅ [ADMIN FETCH] Using ${adminEmails.length} fallback admin email(s) from .env`);
  } else {
    console.warn('⚠️ [ADMIN FETCH] No admin emails configured (no database admins and no .env fallback)');
  }

  return adminEmails;
}

/**
 * Send sign-out reason notification email to admins
 */
export async function sendSignOutReasonEmail({ 
  userEmail, 
  userName, 
  signOutReason, 
  adminEmails = [] 
}) {
  if (!signOutReason || !signOutReason.trim()) {
    console.log('⚠️ [ADMIN NOTIFICATIONS] No sign-out reason provided, skipping email');
    return null;
  }

  // If no admin emails provided, fetch dynamically from database
  let emailRecipients = adminEmails;
  if (!emailRecipients || emailRecipients.length === 0) {
    console.log('📧 [ADMIN NOTIFICATIONS] No admin emails provided, fetching from database...');
    emailRecipients = await getAdminEmails();
  }

  if (!emailRecipients || emailRecipients.length === 0) {
    console.warn('⚠️ [ADMIN NOTIFICATIONS] No admin emails available, cannot send notification');
    return null;
  }

  const subject = '📋 User Sign-Out Feedback — Campus Life | Paltech';
  
  const bodyHtml = `
    <div style="font-size:14px;color:#111827;">
      <p>A user has provided feedback upon signing out of their account.</p>
      
      <div style="background:#eff6ff;border-left:4px solid #0284c7;padding:16px;margin:20px 0;border-radius:8px;">
        <h3 style="margin:0 0 8px;color:#0284c7;font-size:16px;">User Sign-Out Feedback</h3>
        <p style="margin:0;color:#374151;font-size:14px;">
          <strong>User:</strong> ${userName || 'Unknown User'}<br/>
          <strong>Email:</strong> ${userEmail || 'N/A'}<br/>
          <strong>Timestamp:</strong> ${new Date().toLocaleString('en-US', { 
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </p>
      </div>

      <h3 style="margin-top:20px;margin-bottom:8px;color:#0f172a;font-size:15px;">Feedback Message</h3>
      <div style="background:#f9fafb;padding:14px;border-radius:8px;border:1px solid #e5e7eb;color:#374151;line-height:1.6;word-break:break-word;">
        ${signOutReason.split('\n').map(line => `<p style="margin:0 0 8px;white-space:pre-wrap;">${line || '&nbsp;'}</p>`).join('')}
      </div>

      <p style="color:#6b7280;font-size:13px;margin-top:24px;">This is an automated notification. Please review this feedback and take appropriate action if needed.</p>
    </div>
  `;

  const plainText = `
User Sign-Out Feedback

A user has provided feedback upon signing out of their account.

USER SIGN-OUT FEEDBACK
User: ${userName || 'Unknown User'}
Email: ${userEmail || 'N/A'}
Timestamp: ${new Date().toLocaleString('en-US', { 
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})}

FEEDBACK MESSAGE
${signOutReason}

---
This is an automated notification. Please review this feedback and take appropriate action if needed.

Campus Life | Paltech
Your digital campus companion
  `.trim();

  const html = buildBrandedEmailHtml({ title: subject, body: bodyHtml });

  try {
    // Send email to all admin emails
    const emailPromises = emailRecipients.map(adminEmail => 
      sendEmail({ 
        to: adminEmail, 
        subject, 
        text: plainText, 
        html 
      })
    );

    const results = await Promise.allSettled(emailPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ [ADMIN NOTIFICATIONS] Sign-out feedback sent to ${successful}/${emailRecipients.length} admin(s)`);
    
    if (failed > 0) {
      console.warn(`⚠️ [ADMIN NOTIFICATIONS] Failed to send to ${failed} admin email(s)`);
    }

    return { success: true, sent: successful, failed };
  } catch (error) {
    console.error('❌ [ADMIN NOTIFICATIONS] Failed to send sign-out feedback email:', error.message);
    throw error;
  }
}
