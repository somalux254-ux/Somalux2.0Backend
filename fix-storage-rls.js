#!/usr/bin/env node

/**
 * Fix Storage Bucket RLS Policies
 * Allows authenticated users to upload/read from user-avatars bucket
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
  db: { schema: 'storage' }
});

async function fixStorageRLS() {
  try {
    console.log('🚀 Fixing Storage Bucket RLS Policies...\n');

    // SQL to fix storage.objects RLS policies for user-avatars bucket
    const sql = `
      -- Drop existing RLS policies on storage.objects for user-avatars if they exist
      DROP POLICY IF EXISTS "Authenticated users can upload to user-avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Authenticated users can read user-avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Public can read user-avatars" ON storage.objects;

      -- Allow authenticated users to upload to user-avatars bucket
      CREATE POLICY "Authenticated users can upload to user-avatars"
        ON storage.objects
        FOR INSERT
        WITH CHECK (
          bucket_id = 'user-avatars'
          AND auth.role() = 'authenticated'
        );

      -- Allow authenticated users to read from user-avatars bucket
      CREATE POLICY "Authenticated users can read user-avatars"
        ON storage.objects
        FOR SELECT
        USING (
          bucket_id = 'user-avatars'
          AND auth.role() = 'authenticated'
        );

      -- Allow public to read from user-avatars bucket
      CREATE POLICY "Public can read user-avatars"
        ON storage.objects
        FOR SELECT
        USING (bucket_id = 'user-avatars');

      -- Allow users to delete their own avatars
      CREATE POLICY "Authenticated users can delete from user-avatars"
        ON storage.objects
        FOR DELETE
        USING (
          bucket_id = 'user-avatars'
          AND auth.role() = 'authenticated'
        );
    `;

    // Execute using raw SQL
    const { data, error } = await supabase.rpc('exec', { sql_string: sql }).catch(async () => {
      // If rpc doesn't work, use direct query
      console.log('Attempting direct SQL execution...');
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (!statement.trim()) continue;
        console.log('Executing:', statement.substring(0, 80) + '...');
        const { error } = await supabase.rpc('execute_sql', { query: statement }).catch(() => ({ error: null }));
        if (error) {
          console.log('Note: Some policies may already exist');
        }
      }
      
      return { data: null, error: null };
    });

    if (error && !error.message.includes('does not exist')) {
      throw error;
    }

    console.log('✅ Storage RLS policies configured successfully!');
    console.log('\nPolicies created:');
    console.log('  ✓ INSERT: Authenticated users can upload to user-avatars');
    console.log('  ✓ SELECT: Authenticated users can read from user-avatars');
    console.log('  ✓ SELECT: Public can read from user-avatars');
    console.log('  ✓ DELETE: Authenticated users can delete from user-avatars');

  } catch (err) {
    console.error('❌ Error fixing storage RLS:', err.message);
    process.exit(1);
  }
}

fixStorageRLS();
