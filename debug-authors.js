import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkAuthors() {
  console.log('\n📊 Checking books and authors in database...\n');

  try {
    // Get total books count
    const { data: allBooks, error: booksError } = await supabase
      .from('books')
      .select('*', { count: 'exact' });

    if (booksError) {
      console.error('❌ Error fetching books:', booksError);
      return;
    }

    console.log(`📚 Total books in database: ${allBooks?.length || 0}`);

    if (!allBooks || allBooks.length === 0) {
      console.log('⚠️  No books found in database!');
      return;
    }

    // Get books with authors
    const { data: booksWithAuthors, error: authorError } = await supabase
      .from('books')
      .select('id, title, author, cover_image_url')
      .neq('author', null)
      .not('author', 'eq', '')
      .limit(20);

    if (authorError) {
      console.error('❌ Error fetching books with authors:', authorError);
      return;
    }

    console.log(`\n✅ Books with authors (showing first 20): ${booksWithAuthors?.length || 0}\n`);

    if (booksWithAuthors && booksWithAuthors.length > 0) {
      booksWithAuthors.forEach((book, i) => {
        console.log(`${i + 1}. "${book.title}" by ${book.author}`);
      });
    } else {
      console.log('⚠️  No books with authors found!');
      console.log('\nShowing all books (including those without authors):');
      allBooks.slice(0, 20).forEach((book, i) => {
        console.log(`${i + 1}. "${book.title}" by "${book.author || 'N/A'}"`);
      });
    }

    // Extract unique authors
    const authors = new Set();
    (booksWithAuthors || []).forEach(book => {
      if (book.author && book.author.trim()) {
        authors.add(book.author.trim());
      }
    });

    console.log(`\n🎯 Unique authors found: ${authors.size}`);
    if (authors.size > 0) {
      console.log('Authors:');
      Array.from(authors).slice(0, 10).forEach((author, i) => {
        console.log(`  ${i + 1}. ${author}`);
      });
      if (authors.size > 10) console.log(`  ... and ${authors.size - 10} more`);
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

checkAuthors();
