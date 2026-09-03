#!/usr/bin/env node

/**
 * Quick Fix: Populate Past Papers Data
 * This script migrates data from old columns to new columns
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixPastPapersData() {
  console.log('🔄 Migrating Past Papers Data...\n');

  try {
    // Step 1: Fetch all past papers
    console.log('📥 Fetching all past papers...');
    const { data: papers, error: fetchError } = await supabase
      .from('past_papers')
      .select('id, title, subject, course_code, exam_year, downloads_count, views_count, file_url');

    if (fetchError) {
      console.error('❌ Failed to fetch past papers:', fetchError.message);
      process.exit(1);
    }

    console.log(`✅ Found ${papers.length} past papers\n`);

    // Step 2: Update each record
    let updated = 0;
    let errors = [];

    for (const paper of papers) {
      const updates = {};
      let hasChanges = false;

      // Migrate course_code to unit_code
      if (!paper.unit_code && paper.course_code) {
        updates.unit_code = paper.course_code;
        hasChanges = true;
      }

      // Migrate subject to faculty
      if (!paper.faculty && paper.subject) {
        updates.faculty = paper.subject;
        hasChanges = true;
      }

      // Extract unit_name from title if not set
      if (!paper.unit_name && paper.title && paper.title.includes(' - ')) {
        const parts = paper.title.split(' - ');
        if (parts.length >= 2) {
          updates.unit_name = parts.slice(1).join(' - ').trim();
          hasChanges = true;
        }
      }

      // Set defaults if still empty
      if (!updates.unit_code && !paper.unit_code) {
        updates.unit_code = `PP-${paper.id.substring(0, 8)}`;
        hasChanges = true;
      }

      if (!updates.unit_name && !paper.unit_name) {
        updates.unit_name = paper.title || 'Past Paper';
        hasChanges = true;
      }

      if (!updates.faculty && !paper.faculty) {
        updates.faculty = 'General';
        hasChanges = true;
      }

      // Ensure file_path is set
      if (!paper.file_path && paper.file_url) {
        updates.file_path = paper.file_url;
        hasChanges = true;
      }

      // Ensure views is synced
      if (!paper.views && paper.views_count) {
        updates.views = paper.views_count;
        hasChanges = true;
      }

      if (hasChanges) {
        const { error: updateError } = await supabase
          .from('past_papers')
          .update(updates)
          .eq('id', paper.id);

        if (updateError) {
          errors.push({ id: paper.id, error: updateError.message });
          console.log(`❌ Failed to update ${paper.id}: ${updateError.message}`);
        } else {
          updated++;
          process.stdout.write('.');
        }
      }
    }

    console.log('\n');
    console.log('='.repeat(60));
    console.log(`✅ Migration Complete!`);
    console.log(`   Updated: ${updated} records`);
    console.log(`   Errors: ${errors.length}`);
    console.log('='.repeat(60));

    // Step 3: Verify the migration
    console.log('\n🔍 Verification:\n');
    const { data: sample } = await supabase
      .from('past_papers')
      .select('id, unit_code, unit_name, faculty, downloads_count, views_count')
      .limit(3);

    if (sample && sample.length > 0) {
      sample.forEach((record, idx) => {
        console.log(`Record ${idx + 1}:`);
        console.log(`  Unit Code: ${record.unit_code || '(empty)'}`);
        console.log(`  Unit Name: ${record.unit_name || '(empty)'}`);
        console.log(`  Faculty: ${record.faculty || '(empty)'}`);
        console.log(`  Downloads: ${record.downloads_count}`);
        console.log(`  Views: ${record.views_count}`);
        console.log();
      });
    }

    console.log('💡 Next Steps:');
    console.log('1. Open browser DevTools Console');
    console.log('2. Run: localStorage.clear()');
    console.log('3. Refresh the page (F5)');
    console.log('4. Go to Admin > Content Management > Past Papers tab');
    console.log('5. Unit Code, Unit Name, and Faculty should now display!\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixPastPapersData();
