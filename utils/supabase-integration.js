/**
 * Supabase Integration Setup Guide
 * Complete guide for setting up SomaLux with Supabase database
 */

// ============================================
// SUPABASE INTEGRATION HELPER
// ============================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Initialize Supabase client for authenticated requests
 * Use this in the frontend and for user operations
 */
export function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Initialize Supabase admin client for server-side operations
 * Use this only on the server side for admin operations
 */
export function createSupabaseAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection() {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from('profiles').select('COUNT(*)').limit(1);
    
    if (error) throw error;
    
    return { success: true, message: '✅ Connected to Supabase' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Initialize storage buckets
 */
export async function initializeStorageBuckets() {
  const supabase = createSupabaseAdminClient();
  const buckets = [
    { name: 'book-covers', isPublic: true },
    { name: 'book-files', isPublic: false },
    { name: 'past-papers', isPublic: false },
    { name: 'user-avatars', isPublic: true }
  ];

  const results = [];

  for (const bucket of buckets) {
    try {
      // Try to create bucket
      const { data, error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.isPublic,
        fileSizeLimit: 524288000 // 500MB
      });

      if (error && error.message.includes('already exists')) {
        results.push({ bucket: bucket.name, status: 'already exists' });
      } else if (error) {
        results.push({ bucket: bucket.name, status: 'error', error: error.message });
      } else {
        results.push({ bucket: bucket.name, status: 'created' });
      }
    } catch (err) {
      results.push({ bucket: bucket.name, status: 'error', error: err.message });
    }
  }

  return results;
}

/**
 * Common database operations
 */
export const Database = {
  // ============================================
  // USER OPERATIONS
  // ============================================
  
  Users: {
    /**
     * Create user profile after authentication
     */
    async createProfile(userId, userData) {
      const supabase = createSupabaseAdminClient();
      const SUPERADMIN_EMAILS = ['campuslives254@gmail.com', 'paltechsomalux@gmail.com'];
      const userEmail = userData.email || '';
      const isSuperAdmin = SUPERADMIN_EMAILS.includes(userEmail.toLowerCase());
      
      return supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userData.email,
          full_name: userData.fullName,
          username: userData.username,
          role: isSuperAdmin ? 'admin' : 'viewer',
          ...userData
        })
        .select()
        .single();
    },

    /**
     * Get user profile with stats
     */
    async getProfileWithStats(userId) {
      const supabase = createSupabaseAdminClient();
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) return { error: profileError };

      const { data: stats } = await supabase
        .from('user_reading_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      return { 
        data: { 
          profile, 
          stats: stats || {}
        } 
      };
    },

    /**
     * Update user tier
     */
    async updateUserTier(userId, tier) {
      const supabase = createSupabaseAdminClient();
      return supabase
        .from('profiles')
        .update({ tier, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
    }
  },

  // ============================================
  // BOOK OPERATIONS
  // ============================================
  
  Books: {
    /**
     * Get featured books
     */
    async getFeaturedBooks(limit = 6) {
      const supabase = createSupabaseClient();
      return supabase
        .from('books')
        .select('id, title, author, cover_image_url, rating, downloads_count')
        .eq('status', 'published')
        .eq('is_featured', true)
        .order('downloads', { ascending: false })
        .limit(limit);
    },

    /**
     * Search books
     */
    async searchBooks(query, filters = {}) {
      const supabase = createSupabaseClient();
      
      let q = supabase
        .from('books')
        .select('id, title, author, cover_image_url, rating')
        .eq('status', 'published');

      if (query) {
        q = q.or(`title.ilike.%${query}%,author.ilike.%${query}%`);
      }

      if (filters.minRating) {
        q = q.gte('average_rating', filters.minRating);
      }

      if (filters.sortBy === 'downloads') {
        q = q.order('downloads_count', { ascending: false });
      } else if (filters.sortBy === 'rating') {
        q = q.order('average_rating', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }

      return q.limit(filters.limit || 20);
    },

    /**
     * Get book with full details
     */
    async getBookDetails(bookId) {
      const supabase = createSupabaseClient();
      
      const { data: book } = await supabase
        .from('books')
        .select(`
          *,
          ratings:book_ratings(rating, review, user:profiles(full_name, avatar_url))
        `)
        .eq('id', bookId)
        .single();

      return { data: book };
    },

    /**
     * Record book view
     */
    async recordBookView(bookId, userId = null) {
      const supabase = createSupabaseAdminClient();
      
      await supabase
        .from('book_views')
        .insert({
          book_id: bookId,
          user_id: userId
        });

      // Increment view count
      return supabase.rpc('increment_book_views', { p_book_id: bookId });
    },

    /**
     * Like/unlike a book
     */
    async toggleBookLike(bookId, userId) {
      const supabase = createSupabaseAdminClient();
      
      const { data: existing } = await supabase
        .from('book_likes')
        .select('id')
        .eq('book_id', bookId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        return supabase
          .from('book_likes')
          .delete()
          .eq('id', existing.id);
      } else {
        return supabase
          .from('book_likes')
          .insert({
            book_id: bookId,
            user_id: userId
          });
      }
    },

    /**
     * Rate a book
     */
    async rateBook(bookId, userId, rating, review = null) {
      const supabase = createSupabaseAdminClient();
      
      return supabase
        .from('book_ratings')
        .upsert({
          book_id: bookId,
          user_id: userId,
          rating,
          review
        })
        .select()
        .single();
    }
  },

  // ============================================
  // ADMIN OPERATIONS
  // ============================================

  Admin: {
    /**
     * Get system health stats
     */
    async getSystemHealth() {
      const supabase = createSupabaseAdminClient();
      return supabase.rpc('get_system_health_stats');
    },

    /**
     * Get pending submissions
     */
    async getPendingSubmissions() {
      const supabase = createSupabaseAdminClient();
      
      const [bookSubs, paperSubs] = await Promise.all([
        supabase
          .from('book_submissions')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('past_paper_submissions')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
      ]);

      return {
        books: bookSubs.data || [],
        papers: paperSubs.data || []
      };
    },

    /**
     * Approve book submission
     */
    async approveBookSubmission(submissionId, reviewerId) {
      const supabase = createSupabaseAdminClient();
      return supabase.rpc('approve_book_submission', {
        p_submission_id: submissionId,
        p_reviewer_id: reviewerId
      });
    },

    /**
     * Reject submission
     */
    async rejectSubmission(submissionId, reviewerId, reason, type = 'book') {
      const supabase = createSupabaseAdminClient();
      
      const table = type === 'book' ? 'book_submissions' : 'past_paper_submissions';
      
      return supabase
        .from(table)
        .update({
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', submissionId)
        .select()
        .single();
    },

    /**
     * Create audit log
     */
    async logAuditEvent(actor, action, entity, recordId, details = {}) {
      const supabase = createSupabaseAdminClient();
      
      return supabase
        .from('audit_logs')
        .insert({
          actor,
          action,
          entity,
          record_id: recordId,
          details
        });
    },

    /**
     * Get audit logs
     */
    async getAuditLogs(limit = 100, offset = 0) {
      const supabase = createSupabaseAdminClient();
      
      return supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    }
  }
};

// ============================================
// EXPORT FUNCTIONS
// ============================================

export default {
  createSupabaseClient,
  createSupabaseAdminClient,
  testSupabaseConnection,
  initializeStorageBuckets,
  Database
};
