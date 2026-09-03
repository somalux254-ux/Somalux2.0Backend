/**
 * SUPABASE API QUICK REFERENCE
 * Common database operations for all system components
 */

// ============================================
// 1. BOOK MANAGEMENT APIs
// ============================================

/**
 * GET /api/books/featured
 * Get featured books for homepage
 * Response: { success: true, books: [...] }
 */
export const getBooksAPI = {
  featured: async (limit = 6) => {
    const response = await fetch(`/api/books/featured?limit=${limit}`);
    return response.json();
  },

  // GET /api/books/search?query=clean&sortBy=rating
  search: async (query, filters = {}) => {
    const params = new URLSearchParams({ query, ...filters });
    const response = await fetch(`/api/books/search?${params}`);
    return response.json();
  },

  // GET /api/books/:id
  getById: async (bookId) => {
    const response = await fetch(`/api/books/${bookId}`);
    return response.json();
  },

  // POST /api/books/submit (user submission)
  submit: async (formData) => {
    const response = await fetch('/api/books/submit', {
      method: 'POST',
      body: formData // multipart/form-data with file
    });
    return response.json();
  }
};

// ============================================
// 3. PAST PAPERS APIs
// ============================================

export const pastPapersAPI = {
  // GET /api/past-papers/search?subject=maths&university=oxford
  search: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/past-papers/search?${params}`);
    return response.json();
  },

  // GET /api/past-papers/:id
  getById: async (paperId) => {
    const response = await fetch(`/api/past-papers/${paperId}`);
    return response.json();
  },

  // GET /api/past-papers/by-university/:universityId
  getByUniversity: async (universityId) => {
    const response = await fetch(`/api/past-papers/by-university/${universityId}`);
    return response.json();
  },

  // POST /api/past-papers/submit
  submit: async (formData) => {
    const response = await fetch('/api/past-papers/submit', {
      method: 'POST',
      body: formData
    });
    return response.json();
  }
};

// ============================================
// 5. USER PROFILE APIs
// ============================================

export const userAPI = {
  // GET /api/users/:userId/profile
  getProfile: async (userId) => {
    const response = await fetch(`/api/users/${userId}/profile`);
    return response.json();
  },

  // PATCH /api/users/:userId/profile
  updateProfile: async (userId, updates) => {
    const response = await fetch(`/api/users/${userId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return response.json();
  },

  // POST /api/users/:userId/avatar (upload avatar)
  uploadAvatar: async (userId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`/api/users/${userId}/avatar`, {
      method: 'POST',
      body: formData
    });
    return response.json();
  },

  // GET /api/users/:userId/tier
  getTier: async (userId) => {
    const response = await fetch(`/api/users/${userId}/tier`);
    return response.json();
  },

  // PATCH /api/users/:userId/tier
  updateTier: async (userId, tier) => {
    const response = await fetch(`/api/users/${userId}/tier`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier })
    });
    return response.json();
  }
};

// ============================================
// 6. ADMIN APIs
// ============================================

export const adminAPI = {
  // GET /api/admin/dashboard
  getDashboard: async () => {
    const response = await fetch('/api/admin/dashboard');
    return response.json();
  },

  // GET /api/admin/submissions
  getSubmissions: async (type = 'all') => {
    const response = await fetch(`/api/admin/submissions?type=${type}`);
    return response.json();
  },

  // POST /api/admin/submissions/:id/approve
  approveSubmission: async (submissionId, type = 'book') => {
    const response = await fetch(`/api/admin/submissions/${submissionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    return response.json();
  },

  // POST /api/admin/submissions/:id/reject
  rejectSubmission: async (submissionId, reason, type = 'book') => {
    const response = await fetch(`/api/admin/submissions/${submissionId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, type })
    });
    return response.json();
  },

  // GET /api/admin/audit-logs?limit=50
  getAuditLogs: async (limit = 50) => {
    const response = await fetch(`/api/admin/audit-logs?limit=${limit}`);
    return response.json();
  },

  // GET /api/admin/settings
  getSettings: async () => {
    const response = await fetch('/api/admin/settings');
    return response.json();
  },

  // POST /api/admin/settings/:key
  updateSetting: async (key, value) => {
    const response = await fetch(`/api/admin/settings/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    return response.json();
  }
};

// ============================================
// 7. SUBSCRIPTIONS & PAYMENTS
// ============================================

export const subscriptionAPI = {
  getAnalytics: async (timeRange = 'monthly') => {
    const response = await fetch(`/api/search/analytics?timeRange=${timeRange}`);
    return response.json();
  },

  // GET /api/search/trending
  getTrendingSearches: async (limit = 10) => {
    const response = await fetch(`/api/search/trending?limit=${limit}`);
    return response.json();
  }
};

// ============================================
// DATABASE HELPER - Direct Access
// ============================================

/**
 * Import in your components:
 * import { Database } from '@/utils/supabase-integration';
 */

// Example usage in React component:
/*
import { useEffect, useState } from 'react';
import { Database } from '@/utils/supabase-integration';

export function BooksList() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const { data, error } = await Database.Books.searchBooks('', {
          sortBy: 'downloads',
          limit: 20
        });
        
        if (error) throw error;
        setBooks(data);
      } catch (err) {
        console.error('Failed to fetch books:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {books.map(book => (
        <div key={book.id}>
          <h3>{book.title}</h3>
          <p>by {book.author}</p>
          <p>⭐ {book.average_rating} ({book.rating_count} reviews)</p>
          <p>📥 {book.downloads} downloads</p>
        </div>
      ))}
    </div>
  );
}
*/

// ============================================
// ERROR HANDLING PATTERNS
// ============================================

/*
async function safeOperation(operation) {
  try {
    const result = await operation();
    
    if (result.error) {
      console.error('Database error:', result.error);
      return { success: false, error: result.error.message };
    }
    
    return { success: true, data: result.data };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

// Usage:
const { success, data, error } = await safeOperation(() => 
  Database.Books.searchBooks('python')
);

if (!success) {
  // Show error to user
  toast.error(`Failed to search: ${error}`);
}
*/

// ============================================
// PAGINATION PATTERN
// ============================================

/*
async function getPaginatedResults(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  
  const { data, error } = await supabase
    .from('books')
    .select('*', { count: 'exact' })
    .eq('status', 'published')
    .range(offset, offset + pageSize - 1);

  return {
    data: data || [],
    page,
    pageSize,
    total: data?.length || 0
  };
}
*/

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

/*
import { useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase-integration';

export function useRealTimeBooks() {
  const supabase = createSupabaseClient();

  useEffect(() => {
    const subscription = supabase
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'books' },
        (payload) => {
          console.log('Book changed:', payload);
          // Update UI based on payload
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);
}
*/

// ============================================
// BATCH OPERATIONS
// ============================================

/*
async function batchCreateBooks(books) {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('books')
    .insert(books)
    .select();

  return { data, error };
}

// Usage:
const booksToCreate = [
  { title: 'Book 1', author: 'Author 1', ... },
  { title: 'Book 2', author: 'Author 2', ... }
];

const { data, error } = await batchCreateBooks(booksToCreate);
*/

export default {
  getBooksAPI,
  readingAPI,
  pastPapersAPI,
  userAPI,
  adminAPI,
  subscriptionAPI,
  searchAPI
};
