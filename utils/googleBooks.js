import axios from 'axios';

/**
 * Fetch book metadata from Google Books API
 * @param {string} query - ISBN or book title
 * @param {string} apiKey - Google Books API key (optional, but recommended for higher rate limits)
 * @returns {object|null} Book metadata or null if not found
 */
export async function fetchGoogleBooksMetadata(query, apiKey = null) {
  try {
    // Determine if query is ISBN or title
    const isISBN = /^\d{10,13}$/.test(query.replace(/[-\s]/g, ''));
    
    // Build query string
    let searchQuery = isISBN ? `isbn:${query}` : `intitle:"${query}"`;
    
    // Build API URL
    let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=1`;
    if (apiKey) {
      url += `&key=${apiKey}`;
    }

    console.log(`🔍 Searching Google Books: ${searchQuery}`);
    
    const response = await axios.get(url, {
      timeout: 10000,  // 10 second timeout
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.data.items || response.data.items.length === 0) {
      console.log(`❌ No results found for: ${query}`);
      return null;
    }

    const book = response.data.items[0].volumeInfo;
    
    // Extract and format metadata
    const metadata = {
      title: book.title || 'Unknown Title',
      author: (book.authors && book.authors.length > 0) ? book.authors.join(', ') : 'Unknown',
      description: book.description || '',
      isbn: extractISBN(book.industryIdentifiers) || query,
      published_year: book.publishedDate ? parseInt(book.publishedDate.split('-')[0]) : null,
      publisher: book.publisher || '',
      pages: book.pageCount || 0,
      language: book.language || 'en',
      // Try to get the best quality cover image available
      // Prefer medium quality, then small, then null (will be filled during upload)
      cover_image_url: book.imageLinks?.medium || book.imageLinks?.small || book.imageLinks?.thumbnail || book.imageLinks?.smallThumbnail || null,
      categories: book.categories || []
    };

    console.log(`✅ Found book: ${metadata.title} by ${metadata.author}`);
    return metadata;

  } catch (error) {
    if (error.response?.status === 429) {
      console.error('⚠️ Google Books API rate limit exceeded. Consider adding API key or waiting.');
    } else if (error.code === 'ECONNABORTED') {
      console.error('⚠️ Request timeout - Google Books API not responding');
    } else {
      console.error(`❌ Google Books API error:`, error.message);
    }
    return null;
  }
}

/**
 * Extract ISBN-13 or ISBN-10 from industry identifiers
 */
function extractISBN(identifiers) {
  if (!identifiers || !Array.isArray(identifiers)) return null;
  
  // Prefer ISBN-13
  const isbn13 = identifiers.find(id => id.type === 'ISBN_13');
  if (isbn13) return isbn13.identifier;
  
  // Fallback to ISBN-10
  const isbn10 = identifiers.find(id => id.type === 'ISBN_10');
  if (isbn10) return isbn10.identifier;
  
  return null;
}

/**
 * Download cover image from URL
 * @param {string} url - Image URL
 * @returns {Buffer|null} Image buffer or null
 */
export async function downloadCoverImage(url) {
  if (!url) return null;
  
  try {
    console.log(`📥 Downloading cover from: ${url}`);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://books.google.com/',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log(`✅ Cover downloaded (${response.data.length} bytes)`);
    return Buffer.from(response.data);
    
  } catch (error) {
    console.warn(`⚠️ Failed to download cover from ${url}:`, error.message);
    console.warn(`   This is OK - the book will be created without a cover image`);
    return null;
  }
}
