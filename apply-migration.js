#!/usr/bin/env node

/**
 * Apply database migrations to fix submission fields
 * Run with: node apply-migration.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://paltechproject.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('🔄 Starting migration: fix_submission_fields');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '20251208_fix_submission_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by statements (simple approach - split by semicolon)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    let executedCount = 0;
    for (const statement of statements) {
      try {
        // Use Supabase SQL function to execute raw SQL
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.warn(`⚠️  Statement error: ${error.message}`);
          console.warn(`   Statement: ${statement.substring(0, 80)}...`);
        } else {
          executedCount++;
          console.log(`✅ Executed statement ${executedCount}/${statements.length}`);
        }
      } catch (e) {
        console.error(`❌ Failed to execute statement:`, statement.substring(0, 80), e.message);
      }
    }
    
    console.log(`\n✅ Migration complete! Executed ${executedCount}/${statements.length} statements`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
