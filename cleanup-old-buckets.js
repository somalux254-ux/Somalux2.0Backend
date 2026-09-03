import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client with service role key
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const oldBuckets = [
  'avatars'  // We're replacing this with 'user-avatars'
];

async function cleanupOldBuckets() {
  console.log('🗑️ Cleaning up old buckets...\n');

  for (const bucketName of oldBuckets) {
    try {
      // Check if bucket exists
      const { data: existingBucket, error: listError } = await supabase.storage.getBucket(bucketName);
      
      if (!existingBucket) {
        console.log(`⏭️  Bucket "${bucketName}" doesn't exist (skipping)`);
        continue;
      }

      // Delete bucket
      const { error } = await supabase.storage.deleteBucket(bucketName);

      if (error) {
        console.error(`⚠️  Warning: Could not delete bucket "${bucketName}": ${error.message}`);
        console.log(`   (Try deleting manually in Supabase console)`);
        continue;
      }

      console.log(`✅ Deleted bucket: "${bucketName}"`);
    } catch (err) {
      console.error(`❌ Error with bucket "${bucketName}":`, err.message);
    }
  }

  console.log('\n✅ Cleanup complete!');
}

cleanupOldBuckets().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
