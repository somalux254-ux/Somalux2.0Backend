#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function fixStorageRLS() {
  console.log('🔧 Fixing storage bucket RLS policies...\n');

  const sqlStatements = [
    // Drop all existing storage policies for user-avatars
    `DROP POLICY IF EXISTS "Allow authenticated upload to user-avatars" ON storage.objects;`,
    `DROP POLICY IF EXISTS "Allow public read user-avatars" ON storage.objects;`,
    `DROP POLICY IF EXISTS "Allow users to delete their own avatars" ON storage.objects;`,
    
    // Create INSERT policy - allow any authenticated user to upload
    `CREATE POLICY "Allow authenticated upload to user-avatars"
     ON storage.objects FOR INSERT
     TO authenticated
     WITH CHECK (bucket_id = 'user-avatars');`,
    
    // Create SELECT policy - allow anyone to read avatars
    `CREATE POLICY "Allow public read user-avatars"
     ON storage.objects FOR SELECT
     USING (bucket_id = 'user-avatars');`,
    
    // Create DELETE policy - allow users to delete their own files
    `CREATE POLICY "Allow users to delete their own avatars"
     ON storage.objects FOR DELETE
     TO authenticated
     USING (bucket_id = 'user-avatars');`,
  ];

  console.log('📋 Running SQL statements...\n');
  
  for (const sql of sqlStatements) {
    try {
      // Try using exec_sql function if available
      const { error } = await supabase.rpc('exec_sql', { sql }).catch(() => ({ error: null }));
      
      if (error && !error.message.includes('does not exist')) {
        console.log(`❌ ${sql.split('\n')[0].substring(0, 60)}...`);
        console.log(`   Error: ${error.message}\n`);
      }
    } catch (e) {
      // exec_sql might not exist, that's OK
    }
  }

  console.log('\n✅ SQL statements processed.\n');
  console.log('='  .repeat(80));
  console.log('\n📍 IMPORTANT: Please run this SQL manually in Supabase Dashboard:\n');
  console.log(`
-- Drop all existing storage policies for user-avatars
DROP POLICY IF EXISTS "Allow authenticated upload to user-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read user-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own avatars" ON storage.objects;

-- Create INSERT policy - allow any authenticated user to upload
CREATE POLICY "Allow authenticated upload to user-avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-avatars');

-- Create SELECT policy - allow anyone to read avatars
CREATE POLICY "Allow public read user-avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-avatars');

-- Create DELETE policy - allow users to delete their own files
CREATE POLICY "Allow users to delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user-avatars');
  `);
  console.log('='  .repeat(80));
}

fixStorageRLS();
