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

const buckets = [
  {
    name: 'university-covers',
    description: 'University logos and cover images',
    public: true
  },
  {
    name: 'elib-covers',
    description: 'Book cover images',
    public: true
  },
  {
    name: 'elib-books',
    description: 'Book PDFs and documents',
    public: true
  },
  {
    name: 'user-avatars',
    description: 'User profile avatars',
    public: true
  },
  {
    name: 'past-papers',
    description: 'University past papers',
    public: true
  },
  {
    name: 'book-files',
    description: 'Book files storage',
    public: true
  },
  {
    name: 'book-covers',
    description: 'Book cover backups',
    public: true
  }
];

async function setupBuckets() {
  console.log('📦 Starting bucket setup...\n');

  for (const bucket of buckets) {
    try {
      // Check if bucket exists
      const { data: existingBucket, error: listError } = await supabase.storage.getBucket(bucket.name);
      
      if (existingBucket) {
        console.log(`✅ Bucket "${bucket.name}" already exists`);
        continue;
      }

      // Create bucket
      const { data, error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: 52428800 // 50MB
      });

      if (error) {
        console.error(`❌ Error creating bucket "${bucket.name}":`, error.message);
        continue;
      }

      console.log(`✅ Created bucket: "${bucket.name}" (Public: ${bucket.public})`);

      // Set up CORS policy for public buckets
      if (bucket.public) {
        const { error: corsError } = await supabase.storage
          .updateBucket(bucket.name, {
            public: true,
            fileSizeLimit: 52428800
          });

        if (!corsError) {
          console.log(`   └─ CORS enabled for ${bucket.name}`);
        }
      }
    } catch (err) {
      console.error(`❌ Error with bucket "${bucket.name}":`, err.message);
    }
  }

  console.log('\n✅ Bucket setup complete!');
  console.log('\n📋 Created buckets:');
  buckets.forEach(b => {
    console.log(`   • ${b.name} (${b.public ? 'Public' : 'Private'})`);
  });
}

setupBuckets().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
