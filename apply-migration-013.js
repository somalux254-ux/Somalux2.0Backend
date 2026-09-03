#!/usr/bin/env node

/**
 * Apply Migration 013: Create university_ratings table
 * Run with: node apply-migration-013.js
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('🔄 Running Migration 013: Create university_ratings table...\n');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '013_create_university_ratings.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by statements - handle multiple statements separated by ;
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const stmtDescription = statement.substring(0, 80).replace(/\n/g, ' ') + (statement.length > 80 ? '...' : '');
      
      try {
        // Execute raw SQL using Supabase's SQL interface
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.error(`❌ Statement ${i + 1} failed: ${error.message}`);
          console.error(`   ${stmtDescription}\n`);
          errorCount++;
        } else {
          console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
          console.log(`   ${stmtDescription}\n`);
          successCount++;
        }
      } catch (e) {
        console.error(`❌ Statement ${i + 1} error: ${e.message}`);
        console.error(`   ${stmtDescription}\n`);
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Migration Results: ${successCount} succeeded, ${errorCount} failed`);
    console.log('='.repeat(60) + '\n');
    
    if (errorCount === 0) {
      console.log('✅ Migration 013 completed successfully!');
      console.log('   Table university_ratings has been created with RLS policies\n');
    } else {
      console.error(`⚠️  Migration completed with ${errorCount} error(s)`);
      console.error('   Check the errors above and retry if needed\n');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
