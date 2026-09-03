import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verifyDatabase() {
  console.log('🔍 Verifying database setup...\n');

  const requiredTables = [
    'profiles',
    'books',
    'book_ratings',
    'book_views',
    'universities',
    'user_universities',
    'past_papers',
    'reading_sessions',
    'user_reading_stats',
    'reading_goals',
    'reading_streaks',
    'user_achievements',
    'author_followers',
    'author_likes',
    'author_loves',
    'author_comments',
    'author_ratings',
    'author_shares',
    'search_events',
    'search_analytics',
    'subscriptions',
    'payments',
    'notifications',
    'messages',
    'group_messages',
    'file_uploads',
    'file_downloads',
    'audit_logs',
    'admin_settings'
  ];

  let createdCount = 0;
  let missingCount = 0;

  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        console.log(`✅ ${table}`);
        createdCount++;
      } else if (error.code === 'PGRST116') {
        console.log(`❌ ${table} - NOT FOUND`);
        missingCount++;
      } else {
        console.log(`⚠️  ${table} - Error: ${error.message}`);
        missingCount++;
      }
    } catch (err) {
      console.log(`❌ ${table} - Error checking table`);
      missingCount++;
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   ✅ Created: ${createdCount}/${requiredTables.length}`);
  console.log(`   ❌ Missing: ${missingCount}/${requiredTables.length}`);

  if (missingCount > 0) {
    console.log('\n⚠️  ACTION REQUIRED:');
    console.log('   1. Go to Supabase SQL Editor');
    console.log('   2. Copy all content from: backend/migrations/001_COMPLETE_DATABASE_SETUP.sql');
    console.log('   3. Paste into SQL Editor and click RUN');
    console.log('   4. Run this script again to verify');
  } else {
    console.log('\n✅ All tables created successfully!');
    console.log('   You can now upload data and display it on web pages.');
  }
}

verifyDatabase().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
