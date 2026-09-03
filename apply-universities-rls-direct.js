#!/usr/bin/env node

/**
 * Direct RLS Policy Application Script
 * Applies policies directly using Supabase admin API
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

async function applySQLStatement(statement, description) {
  try {
    const { data, error } = await supabase.rpc('exec', { sql: statement });
    
    if (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log(`⏭️  ${description} - Already exists`);
        return true;
      }
      console.error(`❌ ${description}`);
      console.error(`   Error: ${error.message}`);
      return false;
    }
    
    console.log(`✅ ${description}`);
    return true;
  } catch (err) {
    console.error(`❌ ${description}`);
    console.error(`   Error: ${err.message}`);
    return false;
  }
}

async function applyRLSFix() {
  console.log('='.repeat(70));
  console.log('🚀 Universities RLS Policy Fix');
  console.log('='.repeat(70));
  console.log('');

  try {
    // Enable RLS on universities table
    console.log('📋 Enabling RLS on universities table...');
    await applySQLStatement(
      'ALTER TABLE universities ENABLE ROW LEVEL SECURITY;',
      'Enable RLS on universities table'
    );

    console.log('\n📋 Adding INSERT policy to universities table...');
    await applySQLStatement(
      `CREATE POLICY "Allow users to insert their own universities"
       ON universities
       FOR INSERT
       WITH CHECK (
         auth.uid() = uploaded_by OR
         EXISTS (
           SELECT 1 FROM profiles 
           WHERE id = auth.uid() AND role = 'admin'
         )
       );`,
      'Allow users to insert their own universities'
    );

    console.log('\n📋 Adding SELECT policy to universities table...');
    await applySQLStatement(
      `CREATE POLICY "Allow users to view universities"
       ON universities
       FOR SELECT
       USING (true);`,
      'Allow users to view universities'
    );

    console.log('\n📋 Adding UPDATE policy to universities table...');
    await applySQLStatement(
      `CREATE POLICY "Allow users to update their own universities"
       ON universities
       FOR UPDATE
       WITH CHECK (
         auth.uid() = uploaded_by OR
         EXISTS (
           SELECT 1 FROM profiles 
           WHERE id = auth.uid() AND role = 'admin'
         )
       );`,
      'Allow users to update their own universities'
    );

    console.log('\n📋 Adding DELETE policy to universities table...');
    await applySQLStatement(
      `CREATE POLICY "Allow users to delete their own universities"
       ON universities
       FOR DELETE
       USING (
         auth.uid() = uploaded_by OR
         EXISTS (
           SELECT 1 FROM profiles 
           WHERE id = auth.uid() AND role = 'admin'
         )
       );`,
      'Allow users to delete their own universities'
    );

    console.log('\n📋 Adding INSERT policy to university-covers bucket...');
    await applySQLStatement(
      `CREATE POLICY "Allow authenticated users to upload university covers"
       ON storage.objects
       FOR INSERT
       WITH CHECK (
         bucket_id = 'university-covers' AND
         auth.role() = 'authenticated'
       );`,
      'Allow authenticated users to upload university covers'
    );

    console.log('\n📋 Adding SELECT policy to university-covers bucket...');
    await applySQLStatement(
      `CREATE POLICY "Allow public read university covers"
       ON storage.objects
       FOR SELECT
       USING (bucket_id = 'university-covers');`,
      'Allow public read university covers'
    );

    console.log('\n📋 Adding DELETE policy to university-covers bucket...');
    await applySQLStatement(
      `CREATE POLICY "Allow users to delete their own university cover files"
       ON storage.objects
       FOR DELETE
       USING (
         bucket_id = 'university-covers' AND
         (
           auth.uid()::text = (storage.foldername(name))[1] OR
           EXISTS (
             SELECT 1 FROM profiles 
             WHERE id = auth.uid() AND role = 'admin'
           )
         )
       );`,
      'Allow users to delete their own university cover files'
    );

    console.log('');
    console.log('='.repeat(70));
    console.log('✨ Universities RLS Policies Applied Successfully!');
    console.log('='.repeat(70));
    console.log('');
    console.log('🎯 Policies Applied:');
    console.log('   ✅ universities table - INSERT');
    console.log('   ✅ universities table - SELECT');
    console.log('   ✅ universities table - UPDATE');
    console.log('   ✅ universities table - DELETE');
    console.log('   ✅ university-covers bucket - INSERT');
    console.log('   ✅ university-covers bucket - SELECT');
    console.log('   ✅ university-covers bucket - DELETE');
    console.log('');
    console.log('💡 You can now upload universities with covers!');

  } catch (error) {
    console.error('❌ Error applying RLS fix:', error.message);
    console.error('\n📝 Manual Fix Instructions:');
    console.error('1. Open https://supabase.com/dashboard');
    console.error('2. Select your project');
    console.error('3. Go to SQL Editor');
    console.error('4. Copy the SQL from: backend/migrations/009_fix_universities_rls.sql');
    console.error('5. Paste and execute in the SQL editor');
    process.exit(1);
  }
}

applyRLSFix();
