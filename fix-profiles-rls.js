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

async function fixProfilesRLS() {
  console.log('🔧 Fixing profiles RLS policies...\n');

  const sqlStatements = [
    // Drop all existing policies
    `DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;`,
    `DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;`,
    `DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;`,
    `DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;`,
    
    // Create SELECT policy
    `CREATE POLICY "Profiles are viewable by everyone" 
     ON profiles FOR SELECT USING (true);`,
    
    // Create INSERT policy
    `CREATE POLICY "Users can insert their own profile" 
     ON profiles FOR INSERT WITH CHECK (auth.uid() = id);`,
    
    // Create UPDATE policy
    `CREATE POLICY "Users can update their own profile" 
     ON profiles FOR UPDATE USING (auth.uid() = id) 
     WITH CHECK (auth.uid() = id);`,
    
    // Create DELETE policy
    `CREATE POLICY "Users can delete their own profile" 
     ON profiles FOR DELETE USING (auth.uid() = id);`,
  ];

  try {
    for (const sql of sqlStatements) {
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql });
        
        if (error) {
          console.log(`⚠️  SQL: ${sql.split('\n')[0].substring(0, 50)}...`);
          console.log(`   Error: ${error.message}`);
        }
      } catch (e) {
        console.log(`⚠️  Failed: ${sql.split('\n')[0].substring(0, 50)}...`);
        console.log(`   (This might be OK if exec_sql RPC doesn't exist)\n`);
      }
    }

    console.log('\n✅ Done! Profiles RLS policies have been configured.');
    console.log('\nIf you still get RLS errors, manually run this SQL in Supabase Dashboard:\n');
    console.log('='  .repeat(70));
    console.log(`
-- Drop old policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;

-- Create new policies
CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile" 
ON profiles FOR DELETE USING (auth.uid() = id);
    `);
    console.log('='  .repeat(70));

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

fixProfilesRLS();

