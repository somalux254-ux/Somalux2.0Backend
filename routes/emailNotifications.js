import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, buildBrandedEmailHtml } from '../utils/email.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Lazy-initialize Supabase clients (only when needed)
let supabase = null;
let supabaseAdmin = null;

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ [EMAIL NOTIFICATIONS] Supabase credentials not configured');
      return null;
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

function getSupabaseAdminClient() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.warn('⚠️ [EMAIL NOTIFICATIONS] Supabase service role not configured - RLS policies will be enforced');
      return null;
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });
  }
  return supabaseAdmin;
}

/**
 * GET /api/admin/notifications - Fetch all notifications with optional filters
 */
router.get('/notifications', async (req, res) => {
  try {
    const { status, type, limit = 50, offset = 0 } = req.query;

    const client = getSupabaseClient();
    if (!client) return res.status(500).json({ success: false, error: 'Database not configured' });

    let query = client
      .from('admin_notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('notification_type', type);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return res.json({
      success: true,
      data,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Error fetching notifications:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch notifications',
    });
  }
});

/**
 * GET /api/admin/notifications/:id - Fetch single notification with delivery logs
 */
router.get('/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const client = getSupabaseClient();
    if (!client) return res.status(500).json({ success: false, error: 'Database not configured' });

    const { data: notification, error: notifError } = await client
      .from('admin_notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (notifError) throw notifError;
    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    // Fetch delivery logs
    const { data: logs, error: logsError } = await client
      .from('admin_notification_logs')
      .select('*')
      .eq('notification_id', id)
      .order('created_at', { ascending: false });

    if (logsError) throw logsError;

    return res.json({
      success: true,
      notification,
      logs,
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Error fetching notification details:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/notifications/send - Send email notifications to users
 * Body: {
 *   title, message, htmlContent?, notificationType, 
 *   recipientType ('all_users', 'specific_users', 'by_role', 'by_tier'),
 *   recipientFilter?, recipientsList?, adminName, adminEmail
 * }
 */
router.post('/notifications/send', async (req, res) => {
  try {
    const {
      title,
      message,
      htmlContent,
      notificationType,
      recipientType,
      recipientFilter = {},
      recipientsList = [],
      adminName,
      adminEmail,
      tags = [],
      isUrgent = false,
    } = req.body;

    // Validation
    if (!title || !message || !notificationType || !recipientType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, message, notificationType, recipientType',
      });
    }

    console.log('📧 [NOTIFICATIONS] Processing send request...');
    console.log('  - Title:', title);
    console.log('  - Type:', notificationType);
    console.log('  - Recipient Type:', recipientType);

    const client = getSupabaseClient();
    if (!client) return res.status(500).json({ success: false, error: 'Database not configured' });

    // Use admin client to bypass RLS for recipient queries
    const adminClient = getSupabaseAdminClient() || client;

    // Fetch recipient list based on recipientType
    let recipients = [];

    if (recipientType === 'all_users') {
      // Fetch all users without limit
      const { data, error } = await adminClient
        .from('profiles')
        .select('id, email')
        .limit(50000); // Fetch up to 50,000 users
      if (error) throw error;
      recipients = data || [];
    } else if (recipientType === 'specific_users' && recipientsList.length > 0) {
      recipients = recipientsList.map((item) => ({
        email: item.email || item,
        id: item.id || null,
      }));
    } else if (recipientType === 'by_role' && recipientFilter.role) {
      const { data, error } = await adminClient
        .from('profiles')
        .select('id, email')
        .eq('role', recipientFilter.role)
        .limit(50000); // Fetch up to 50,000 users
      if (error) throw error;
      recipients = data || [];
    } else if (recipientType === 'by_tier' && recipientFilter.tier) {
      const { data, error } = await adminClient
        .from('profiles')
        .select('id, email')
        .eq('subscription_tier', recipientFilter.tier)
        .limit(50000); // Fetch up to 50,000 users
      if (error) throw error;
      recipients = data || [];
    }

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No recipients found matching the criteria',
      });
    }

    console.log(`📧 [NOTIFICATIONS] Found ${recipients.length} recipients`);

    // Create notification record using admin client (bypasses RLS)
    const notificationId = uuidv4();
    
    const { error: createError } = await adminClient
      .from('admin_notifications')
      .insert([
        {
          id: notificationId,
          admin_name: adminName,
          admin_email: adminEmail,
          notification_type: notificationType,
          title,
          message,
          html_content: htmlContent,
          recipient_type: recipientType,
          recipient_filter: recipientFilter,
          recipients_list: recipientsList.length > 0 ? JSON.stringify(recipientsList) : null,
          recipient_count: recipients.length,
          status: 'sending',
          sent_count: 0,
          failed_count: 0,
          tags,
          is_urgent: isUrgent,
        },
      ]);

    if (createError) throw createError;

    // Build email HTML
    const emailHtml = htmlContent || buildBrandedEmailHtml({
      title,
      body: message,
    });

    // Send emails (in background, don't wait)
    sendEmailsInBackground(notificationId, title, emailHtml, recipients).catch((err) => {
      console.error('❌ [NOTIFICATIONS] Background email sending failed:', err);
    });

    return res.json({
      success: true,
      message: `Email sending initiated. Notification ID: ${notificationId}`,
      notificationId,
      recipientCount: recipients.length,
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Error sending notifications:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Background function to send emails and track delivery
 */
async function sendEmailsInBackground(notificationId, subject, htmlContent, recipients) {
  let sentCount = 0;
  let failedCount = 0;

  const client = getSupabaseClient();
  const adminClient = getSupabaseAdminClient() || client;
  if (!client) {
    console.error('❌ [NOTIFICATIONS] Database not configured for background send');
    return;
  }

  console.log(`📧 [NOTIFICATIONS] Starting background send for ${recipients.length} recipients...`);

  for (const recipient of recipients) {
    try {
      // Fetch user details for personalization
      const { data: userData, error: userError } = await adminClient
        .from('profiles')
        .select('display_name, email')
        .eq('email', recipient.email)
        .single();

      let personalizedHtml = htmlContent;
      let userName = userData?.display_name || recipient.email.split('@')[0] || 'User';

      // Replace placeholders with actual user name
      personalizedHtml = personalizedHtml.replace(/Dear User/gi, `Dear ${userName}`);
      personalizedHtml = personalizedHtml.replace(/{{username}}/gi, userName);
      personalizedHtml = personalizedHtml.replace(/{{user_name}}/gi, userName);
      personalizedHtml = personalizedHtml.replace(/{{display_name}}/gi, userName);

      // Send email with personalized content
      await sendEmail({
        to: recipient.email,
        subject,
        html: personalizedHtml,
      });

      // Log success
      await adminClient.from('admin_notification_logs').insert([
        {
          notification_id: notificationId,
          user_id: recipient.id || null,
          user_email: recipient.email,
          status: 'sent',
          sent_at: new Date().toISOString(),
        },
      ]);

      sentCount++;
      console.log(`✅ [NOTIFICATIONS] Sent to ${recipient.email}`);
    } catch (error) {
      failedCount++;
      console.error(`❌ [NOTIFICATIONS] Failed to send to ${recipient.email}:`, error.message);

      // Log failure
      await adminClient.from('admin_notification_logs').insert([
        {
          notification_id: notificationId,
          user_id: recipient.id || null,
          user_email: recipient.email,
          status: 'failed',
          error_message: error.message,
        },
      ]).catch((err) => {
        console.error('❌ [NOTIFICATIONS] Failed to log error:', err);
      });
    }

    // Small delay to prevent rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Update notification record with final counts
  const { error: updateError } = await adminClient
    .from('admin_notifications')
    .update({
      status: failedCount === 0 ? 'sent' : 'partial',
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (updateError) {
    console.error('❌ [NOTIFICATIONS] Failed to update notification status:', updateError);
  }

  console.log(`✅ [NOTIFICATIONS] Background send complete: ${sentCount} sent, ${failedCount} failed`);
}

/**
 * GET /api/admin/templates - Fetch email templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('email_templates')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) throw error;

    return res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('❌ [TEMPLATES] Error fetching templates:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/templates - Create new email template
 */
router.post('/templates', async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      subject,
      body,
      htmlBody,
      variables = {},
      isPublic = true,
      adminId,
    } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, subject, body',
      });
    }

    const { data, error } = await supabase
      .from('email_templates')
      .insert([
        {
          name,
          category,
          description,
          subject,
          body,
          html_body: htmlBody,
          variables,
          is_public: isPublic,
          created_by: adminId || null,
        },
      ])
      .select();

    if (error) throw error;

    return res.json({
      success: true,
      data: data?.[0],
    });
  } catch (error) {
    console.error('❌ [TEMPLATES] Error creating template:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/notification-stats - Get notification stats
 */
router.get('/notification-stats', async (req, res) => {
  try {
    const client = getSupabaseClient();
    if (!client) return res.status(500).json({ success: false, error: 'Database not configured' });

    // Fetch all notifications
    const { error, data } = await client
      .from('admin_notifications')
      .select('status');

    if (error) throw error;

    const stats = {
      total: 0,
      sent: 0,
      failed: 0,
      scheduled: 0,
      draft: 0,
      sending: 0,
    };

    // Count statuses manually
    if (data && Array.isArray(data)) {
      stats.total = data.length;
      data.forEach((item) => {
        if (item.status) {
          switch (item.status) {
            case 'sent':
              stats.sent += 1;
              break;
            case 'failed':
              stats.failed += 1;
              break;
            case 'scheduled':
              stats.scheduled += 1;
              break;
            case 'draft':
              stats.draft += 1;
              break;
            case 'sending':
              stats.sending += 1;
              break;
            default:
              break;
          }
        }
      });
    }

    console.log('📊 [STATS] Notification stats:', stats);

    return res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('❌ [STATS] Error fetching notification stats:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/users - Get all users for selection
 */
router.get('/users', async (req, res) => {
  try {
    // Use admin client to bypass RLS policies
    const adminClient = getSupabaseAdminClient() || getSupabaseClient();
    if (!adminClient) {
      console.error('❌ [USERS] Supabase not configured');
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    // Fetch all users with id, email, display_name, and avatar_url from profiles table
    const { error, data } = await adminClient
      .from('profiles')
      .select('id, email, display_name, avatar_url')
      .order('email', { ascending: true })
      .limit(50000);

    if (error) {
      console.error('❌ [USERS] Database query error:', error);
      throw error;
    }

    console.log('📊 [USERS] Fetched users count:', data?.length || 0);

    // Transform data to match frontend expectations
    const transformedUsers = (data || []).map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.display_name || '',
      avatar_url: user.avatar_url || ''
    }));

    return res.json({
      success: true,
      users: transformedUsers,
    });
  } catch (error) {
    console.error('❌ [USERS] Error fetching users:', error.message || error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch users',
    });
  }
});

export default router;
