#!/usr/bin/env node

/**
 * Universal Migration Runner for SomaLux
 * Executes SQL migrations from the migrations directory
 * Run with: node run-migration.js <migration-number|migration-name>
 * 
 * Examples:
 *   node run-migration.js 024_create_book_comments_system.sql
 *   node run-migration.js 024
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing environment variables');
  console.error('Ensure .env contains SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Get migration file from command line argument
const migrationArg = process.argv[2];

if (!migrationArg) {
  console.error('❌ Usage: node run-migration.js <migration-file>');
  console.error('Example: node run-migration.js 024_create_book_comments_system.sql');
  process.exit(1);
}

// Construct migration file path
let migrationPath = migrationArg;
if (!migrationPath.endsWith('.sql')) {
  // If just a number given, find the matching file
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir);
  const matching = files.find(f => f.startsWith(migrationArg.padStart(3, '0')));
  
  if (!matching) {
    console.error(`❌ No migration found starting with: ${migrationArg}`);
    process.exit(1);
  }
  
  migrationPath = matching;
}

migrationPath = path.join(__dirname, 'migrations', migrationPath);

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Migration file not found: ${migrationPath}`);
  process.exit(1);
}

async function runMigration() {
  try {
    console.log(`🔄 Running migration: ${path.basename(migrationPath)}\n`);
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon, removing comments and empty statements
    const statements = migrationSQL
      .split(';')
      .map(s => {
        return s
          .split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim();
      })
      .filter(s => s.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 70).replace(/\n/g, ' ');
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          failCount++;
          console.log(`❌ [${i + 1}/${statements.length}] ${preview}...`);
          console.log(`   Error: ${error.message}\n`);
        } else {
          successCount++;
          console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
        }
      } catch (e) {
        failCount++;
        console.log(`❌ [${i + 1}/${statements.length}] ${preview}...`);
        console.log(`   Error: ${e.message}\n`);
      }
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Executed: ${successCount}/${statements.length} statements`);
    
    if (failCount > 0) {
      console.log(`❌ Failed: ${failCount} statements`);
      process.exit(1);
    } else {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// First check if exec_sql function exists, if not show message
async function checkExecSql() {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1;' });
    
    if (error && error.message.includes('Could not find the function')) {
      console.log('⚠️  The exec_sql function does not exist yet.\n');
      console.log('📋 FIRST TIME SETUP REQUIRED:\n');
      console.log('1. Go to https://app.supabase.com/');
      console.log('2. Select your SomaLux project');
      console.log('3. Go to SQL Editor → New query');
      console.log('4. Paste this SQL and run it:\n');
      
      const execSqlPath = path.join(__dirname, 'migrations', '026_create_exec_sql_function.sql');
      const execSqlSQL = fs.readFileSync(execSqlPath, 'utf8');
      console.log(execSqlSQL);
      
      console.log('\n5. After running, execute: node run-migration.js 024\n');
      process.exit(0);
    }
    
    // If no error, exec_sql exists, proceed with migration
    await runMigration();
    
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

checkExecSql();
