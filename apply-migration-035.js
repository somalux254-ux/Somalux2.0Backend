#!/usr/bin/env node

/**
 * Migration Script: Migrate Past Papers Data to New Columns
 * This script populates the new columns (unit_code, unit_name, faculty)
 * from the old columns (course_code, subject) so data displays correctly
 * in the admin Past Papers tab.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  console.log('🔄 Applying Migration 035: Migrate Past Papers Data...\n');

  try {
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'migrations', '035_migrate_past_papers_data.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!\n');
    
    // Verify the migration
    console.log('🔍 Verification Results:');
    console.log('='.repeat(50));
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('past_papers')
      .select('id, unit_code, unit_name, faculty, downloads_count, views_count', { count: 'exact' })
      .limit(5);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      process.exit(1);
    }

    if (verifyData && verifyData.length > 0) {
      console.log(`✅ Sample records (showing first 5):\n`);
      verifyData.forEach((record, idx) => {
        console.log(`Record ${idx + 1}:`);
        console.log(`  Unit Code: ${record.unit_code || 'EMPTY'}`);
        console.log(`  Unit Name: ${record.unit_name || 'EMPTY'}`);
        console.log(`  Faculty: ${record.faculty || 'EMPTY'}`);
        console.log(`  Downloads: ${record.downloads_count}`);
        console.log(`  Views: ${record.views_count}`);
        console.log();
      });
    }

    // Get summary statistics
    const { data: stats } = await supabase.rpc('exec_sql', { 
      sql_string: `
        SELECT 
          COUNT(*) as total_records,
          COUNT(unit_code) as with_unit_code,
          COUNT(unit_name) as with_unit_name,
          COUNT(faculty) as with_faculty
        FROM past_papers
      `
    });

    console.log('\n📊 Summary Statistics:');
    console.log('='.repeat(50));
    console.log('✅ Migration 035 applied successfully!');
    console.log('\n💡 Next Steps:');
    console.log('1. Clear browser cache: localStorage.clear()');
    console.log('2. Refresh the admin dashboard');
    console.log('3. Navigate to Content Management > Past Papers');
    console.log('4. Unit Code, Unit Name, and Faculty should now display');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

applyMigration();
