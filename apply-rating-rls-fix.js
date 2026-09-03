#!/usr/bin/env node

/**
 * Apply RLS Policies for Rating Tables
 * Run with: node apply-rating-rls-fix.js
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://agirxwnwpxpddaqylucg.supabase.co'; // Correct URL with wuwlnawtuhjoubfkdtgc
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Extract PostgreSQL connection details from Supabase URL
const getPostgresConfig = () => {
  const url = new URL(supabaseUrl);
  const projectId = url.hostname.split('.')[0];
  
  return {
    host: `${projectId}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: supabaseKey.split('.')[2], // This won't work - need actual password
  };
};

// Alternative: Use Supabase Admin API to execute SQL
const { Pool } = pg;

async function executeSql(sql) {
  try {
    // We'll use Supabase JS client which supports raw queries
    const { error } = await supabase.from('book_ratings').select('id').limit(1);
    
    // If we get here, we have a connection
    // Now execute the custom SQL via Supabase
    const response = await supabase.rpc('test_function');
    
    // This approach won't work. Let's use a different method.
  } catch (error) {
    console.error('Error:', error);
  }
}

async function applyRLSPolicies() {
  try {
    console.log('🔄 Starting RLS policy fixes for rating tables...\n');
    
    const sqlStatements = [
      // Drop existing policies
      `DROP POLICY IF EXISTS "Anyone can view book ratings" ON public.book_ratings;`,
      `DROP POLICY IF EXISTS "Authenticated users can insert book ratings" ON public.book_ratings;`,
      `DROP POLICY IF EXISTS "Users can update own book ratings" ON public.book_ratings;`,
      `DROP POLICY IF EXISTS "Users can delete own book ratings" ON public.book_ratings;`,
      
      `DROP POLICY IF EXISTS "Anyone can view author ratings" ON public.author_ratings;`,
      `DROP POLICY IF EXISTS "Authenticated users can insert author ratings" ON public.author_ratings;`,
      `DROP POLICY IF EXISTS "Users can update own author ratings" ON public.author_ratings;`,
      `DROP POLICY IF EXISTS "Users can delete own author ratings" ON public.author_ratings;`,
      
      // Create book_ratings policies
      `CREATE POLICY "Anyone can view book ratings"
          ON public.book_ratings
          FOR SELECT
          TO public
          USING (true);`,
      
      `CREATE POLICY "Authenticated users can insert book ratings"
          ON public.book_ratings
          FOR INSERT
          TO authenticated
          WITH CHECK (auth.uid() = user_id);`,
      
      `CREATE POLICY "Users can update own book ratings"
          ON public.book_ratings
          FOR UPDATE
          TO authenticated
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);`,
      
      `CREATE POLICY "Users can delete own book ratings"
          ON public.book_ratings
          FOR DELETE
          TO authenticated
          USING (auth.uid() = user_id);`,
      
      // Create author_ratings policies
      `CREATE POLICY "Anyone can view author ratings"
          ON public.author_ratings
          FOR SELECT
          TO public
          USING (true);`,
      
      `CREATE POLICY "Authenticated users can insert author ratings"
          ON public.author_ratings
          FOR INSERT
          TO authenticated
          WITH CHECK (auth.uid() = user_id);`,
      
      `CREATE POLICY "Users can update own author ratings"
          ON public.author_ratings
          FOR UPDATE
          TO authenticated
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);`,
      
      `CREATE POLICY "Users can delete own author ratings"
          ON public.author_ratings
          FOR DELETE
          TO authenticated
          USING (auth.uid() = user_id);`
    ];

    let successCount = 0;
    let failureCount = 0;

    // Execute all statements
    for (const statement of sqlStatements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try to parse just the policy name
          const policyMatch = statement.match(/"([^"]+)"/);
          const policyName = policyMatch ? policyMatch[1] : statement.substring(0, 40);
          
          console.warn(`⚠️  Failed: ${policyName}`);
          console.warn(`   Error: ${error.message}`);
          failureCount++;
        } else {
          // Parse the policy name from the statement
          const policyMatch = statement.match(/"([^"]+)"/);
          const policyName = policyMatch ? policyMatch[1] : 'Unknown policy';
          console.log(`✅ ${policyName}`);
          successCount++;
        }
      } catch (error) {
        console.warn(`⚠️  Exception: ${error.message}`);
        failureCount++;
      }
    }

    console.log(`\n📊 Summary: ${successCount} succeeded, ${failureCount} failed`);
    
    if (failureCount === 0) {
      console.log('\n✨ All RLS policies have been applied successfully!');
      console.log('Rating submissions should now work correctly.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

await applyRLSPolicies();
