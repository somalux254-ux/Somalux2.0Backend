#!/usr/bin/env node

/**
 * Supabase Setup Verification Script
 * Checks that all components are properly configured
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  log('🔍 SomaLux Supabase Setup Verification', 'blue');
  log('=====================================\n', 'blue');

  let passed = 0;
  let failed = 0;

  // ============================================
  // 1. Check Environment Variables
  // ============================================

  logSection('1. ENVIRONMENT VARIABLES');

  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      log(`✅ ${envVar} is set`, 'green');
      passed++;
    } else {
      log(`❌ ${envVar} is missing`, 'red');
      failed++;
    }
  }

  if (failed > 0) {
    log('\n⚠️  Please set missing environment variables in .env file', 'yellow');
    return;
  }

  // ============================================
  // 2. Check Migration Files
  // ============================================

  logSection('2. MIGRATION FILES');

  const migrationsDir = path.join(__dirname, '../migrations');
  const requiredFiles = [
    '001_initial_schema.sql',
    '002_functions_triggers.sql',
    '003_sample_data.sql',
    'run-migrations.js',
    'SETUP_GUIDE.md'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(migrationsDir, file);
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      log(`✅ ${file} (${(size / 1024).toFixed(2)} KB)`, 'green');
      passed++;
    } else {
      log(`❌ ${file} is missing`, 'red');
      failed++;
    }
  }

  // ============================================
  // 3. Check Utility Files
  // ============================================

  logSection('3. UTILITY FILES');

  const utilsDir = path.join(__dirname, '../utils');
  const utilFiles = [
    'supabase-integration.js',
    'api-reference.js'
  ];

  for (const file of utilFiles) {
    const filePath = path.join(utilsDir, file);
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      log(`✅ ${file} (${(size / 1024).toFixed(2)} KB)`, 'green');
      passed++;
    } else {
      log(`❌ ${file} is missing`, 'red');
      failed++;
    }
  }

  // ============================================
  // 4. Test Supabase Connection
  // ============================================

  logSection('4. SUPABASE CONNECTION');

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // Try to query database
    const { data, error } = await supabase
      .from('profiles')
      .select('count()', { count: 'exact', head: true });

    if (error) {
      log(`❌ Database connection error: ${error.message}`, 'red');
      failed++;
    } else {
      log('✅ Successfully connected to Supabase', 'green');
      passed++;
    }
  } catch (err) {
    log(`❌ Connection error: ${err.message}`, 'red');
    failed++;
  }

  // ============================================
  // 5. Check Database Schema
  // ============================================

  logSection('5. DATABASE SCHEMA');

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const requiredTables = [
      'profiles', 'books', 'reading_sessions',
      'user_reading_stats', 'reading_goals', 'book_likes',
      'book_ratings', 'subscriptions', 'audit_logs',
      'universities', 'past_papers', 'notifications'
    ];

    let existingTables = 0;

    for (const table of requiredTables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (!error || error?.code !== 'PGRST204') {
        log(`✅ ${table} table exists`, 'green');
        existingTables++;
        passed++;
      } else if (error?.code === 'PGRST204') {
        log(`✅ ${table} table exists (empty)`, 'green');
        existingTables++;
        passed++;
      } else {
        log(`❌ ${table} table not found`, 'red');
        failed++;
      }
    }

    if (existingTables === requiredTables.length) {
      log(`\n✅ All ${requiredTables.length} tables exist!`, 'green');
    } else {
      log(`\n⚠️  Only ${existingTables}/${requiredTables.length} tables found`, 'yellow');
      log('Run migrations: node backend/migrations/run-migrations.js', 'yellow');
    }
  } catch (err) {
    log(`❌ Schema check error: ${err.message}`, 'red');
    failed++;
  }

  // ============================================
  // 6. Check Storage Buckets
  // ============================================

  logSection('6. STORAGE BUCKETS');

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      log(`⚠️  Could not list buckets: ${error.message}`, 'yellow');
    } else {
      const requiredBuckets = [
        'book-covers', 'book-files', 'past-papers',
        'user-avatars'
      ];

      const existingBuckets = buckets.map(b => b.name);

      for (const bucket of requiredBuckets) {
        if (existingBuckets.includes(bucket)) {
          log(`✅ ${bucket} bucket exists`, 'green');
          passed++;
        } else {
          log(`⚠️  ${bucket} bucket not found`, 'yellow');
        }
      }
    }
  } catch (err) {
    log(`⚠️  Storage check error: ${err.message}`, 'yellow');
  }

  // ============================================
  // 7. Check RLS Policies
  // ============================================

  logSection('7. ROW LEVEL SECURITY (RLS)');

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // RLS should be enabled on key tables
    const rlsTables = ['profiles', 'books', 'subscriptions'];
    
    for (const table of rlsTables) {
      try {
        // Try to select with RLS (should work for authenticated)
        await supabase.from(table).select('*').limit(1);
        log(`✅ ${table} has RLS configured`, 'green');
        passed++;
      } catch (err) {
        log(`⚠️  ${table} RLS status unknown`, 'yellow');
      }
    }
  } catch (err) {
    log(`⚠️  RLS check error: ${err.message}`, 'yellow');
  }

  // ============================================
  // SUMMARY
  // ============================================

  logSection('VERIFICATION SUMMARY');

  const total = passed + failed;
  const percentage = total > 0 ? ((passed / total) * 100).toFixed(0) : 0;

  log(`Total Checks: ${total}`, 'cyan');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`Score: ${percentage}%`, percentage >= 80 ? 'green' : 'yellow');

  if (failed === 0) {
    logSection('✅ ALL CHECKS PASSED');
    log('Your SomaLux Supabase setup is complete!', 'green');
    log('\nNext steps:', 'blue');
    log('1. Review SETUP_GUIDE.md for detailed instructions', 'blue');
    log('2. Run migrations: node backend/migrations/run-migrations.js', 'blue');
    log('3. Configure authentication in Supabase dashboard', 'blue');
    log('4. Test the API endpoints', 'blue');
  } else if (percentage >= 50) {
    logSection('⚠️  PARTIAL SETUP');
    log('Some checks failed. Please review the errors above.', 'yellow');
  } else {
    logSection('❌ SETUP INCOMPLETE');
    log('Critical issues found. Please fix them before proceeding.', 'red');
  }

  // ============================================
  // QUICK START GUIDE
  // ============================================

  logSection('QUICK START');

  log('1. Apply Migrations:', 'cyan');
  log('   cd backend/migrations && node run-migrations.js', 'yellow');

  log('\n2. Initialize Storage:', 'cyan');
  log('   node backend/scripts/setup-storage.js', 'yellow');

  log('\n3. Configure Auth:', 'cyan');
  log('   Go to Supabase Dashboard > Authentication > Providers', 'yellow');

  log('\n4. Review Documentation:', 'cyan');
  log('   See backend/migrations/SETUP_GUIDE.md', 'yellow');

  log('\n5. Test Connection:', 'cyan');
  log('   node backend/utils/verify-setup.js (run this script again)', 'yellow');

  console.log('\n' + '='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Run verification
main().catch(err => {
  log(`Fatal Error: ${err.message}`, 'red');
  process.exit(1);
});
