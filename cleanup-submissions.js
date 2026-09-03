import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupOldSubmissions() {
  try {
    console.log('🗑️ Cleaning up old submissions with null uploaders...\n');

    // Delete from book_submissions
    const { data: books, error: booksError } = await supabase
      .from('book_submissions')
      .delete()
      .is('uploaded_by', null)
      .eq('status', 'pending');

    if (booksError) throw booksError;
    console.log('✅ Deleted book submissions with null uploaders');

    // Delete from past_paper_submissions
    const { data: papers, error: papersError } = await supabase
      .from('past_paper_submissions')
      .delete()
      .is('uploaded_by', null)
      .eq('status', 'pending');

    if (papersError) throw papersError;
    console.log('✅ Deleted past paper submissions with null uploaders');

    console.log('\n🎉 Cleanup complete! Old submissions removed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

cleanupOldSubmissions();
