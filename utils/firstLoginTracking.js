/**
 * First Login Tracking Utility
 * Handles recording the first login time and date for users
 */

import { UAParser } from 'ua-parser-js';

/**
 * Parse user agent to extract browser and OS information
 * @param {string} userAgent - User agent string from request
 * @returns {object} Parsed browser and OS info
 */
function parseUserAgent(userAgent) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  return {
    browser: result.browser.name || 'Unknown',
    operating_system: result.os.name || 'Unknown',
    device_type: result.device.type || 'desktop' // 'mobile', 'tablet', 'desktop'
  };
}

/**
 * Get client IP address from request
 * @param {object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    'Unknown'
  );
}

/**
 * Record first login for a user
 * @param {string} userId - User ID from auth.users
 * @param {object} supabaseAdmin - Supabase admin client
 * @param {object} req - Express request object (optional)
 * @returns {Promise<object>} Result of the operation
 */
async function recordFirstLogin(userId, supabaseAdmin, req = null) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!supabaseAdmin) {
      console.warn('[First Login] Supabase admin client not available');
      return {
        success: false,
        message: 'Supabase client not configured',
        error: new Error('Supabase client not available')
      };
    }

    // Check if first login already recorded
    const { data: existingRecord, error: checkError } = await supabaseAdmin
      .from('first_login_tracking')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingRecord) {
      console.log(`[First Login] User ${userId} already has a first login record`);
      return {
        success: false,
        message: 'First login already recorded',
        data: existingRecord
      };
    }

    // Prepare first login data
    const now = new Date();
    const nowUTC = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    
    // Extract timezone from request or system
    const timeZoneHeader = req?.headers['x-timezone'] || req?.headers['timezone'];
    const sysTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const firstLoginData = {
      user_id: userId,
      first_login_at: nowUTC.toISOString(),
      first_login_date: nowUTC.toISOString().split('T')[0], // YYYY-MM-DD
      first_login_time: nowUTC.toTimeString().split(' ')[0], // HH:mm:ss
      timezone: timeZoneHeader || sysTimezone || 'UTC',
      ip_address: req ? getClientIP(req) : null,
      user_agent: req?.headers['user-agent'] || null,
      created_at: nowUTC.toISOString()
    };

    // Parse user agent if available
    if (req?.headers['user-agent']) {
      const parsedUA = parseUserAgent(req.headers['user-agent']);
      firstLoginData.browser = parsedUA.browser;
      firstLoginData.operating_system = parsedUA.operating_system;
      firstLoginData.device_type = parsedUA.device_type;
    }

    // Insert the first login record
    const { data, error } = await supabaseAdmin
      .from('first_login_tracking')
      .insert([firstLoginData])
      .select();

    if (error) {
      console.error('[First Login Error] Insert failed:', error);
      console.error('[First Login Error] Error code:', error?.code);
      console.error('[First Login Error] Error message:', error?.message);
      throw error;
    }

    console.log(`[First Login] Successfully recorded first login for user ${userId} at ${firstLoginData.first_login_at}`);
    console.log('[First Login] Recorded data:', data?.[0]);
    
    return {
      success: true,
      message: 'First login recorded successfully',
      data: data?.[0]
    };

  } catch (error) {
    console.error('[First Login] Error recording first login:', error.message);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
}

/**
 * Get first login info for a user
 * @param {string} userId - User ID
 * @param {object} supabaseAdmin - Supabase admin client
 * @returns {Promise<object>} First login record or null
 */
async function getFirstLoginInfo(userId, supabaseAdmin) {
  try {
    if (!supabaseAdmin) {
      console.warn('[First Login] Supabase admin client not available');
      return null;
    }

    const { data, error } = await supabaseAdmin
      .from('first_login_tracking')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[First Login] Error fetching first login info:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[First Login] Error:', error.message);
    return null;
  }
}

/**
 * Get first login statistics
 * @param {object} supabaseAdmin - Supabase admin client
 * @returns {Promise<object>} Statistics about first logins
 */
async function getFirstLoginStatistics(supabaseAdmin) {
  try {
    if (!supabaseAdmin) {
      console.warn('[First Login] Supabase admin client not available');
      return null;
    }

    // Total users with first login recorded
    const { count: totalRecords } = await supabaseAdmin
      .from('first_login_tracking')
      .select('*', { count: 'exact', head: true });

    // Count by device type
    const { data: deviceStats } = await supabaseAdmin
      .from('first_login_tracking')
      .select('device_type')
      .not('device_type', 'is', null);

    const deviceBreakdown = {};
    deviceStats?.forEach(record => {
      deviceBreakdown[record.device_type] = (deviceBreakdown[record.device_type] || 0) + 1;
    });

    // First login dates distribution (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentLogins } = await supabaseAdmin
      .from('first_login_tracking')
      .select('first_login_date')
      .gte('first_login_date', thirtyDaysAgo.toISOString().split('T')[0]);

    return {
      total_first_logins: totalRecords || 0,
      device_breakdown: deviceBreakdown,
      recent_logins_30_days: recentLogins?.length || 0
    };
  } catch (error) {
    console.error('[First Login Stats] Error:', error.message);
    return null;
  }
}

export {
  recordFirstLogin,
  getFirstLoginInfo,
  getFirstLoginStatistics,
  parseUserAgent,
  getClientIP
};
