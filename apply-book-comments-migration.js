#!/usr/bin/env node

/**
 * Apply book comments system migration
 * Run with: node apply-book-comments-migration.js
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

console.log('Loading environment variables...');
console.log('SUPABASE_URL:', supabaseUrl ? '✅ Found' : '❌ Not found');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ Found' : '❌ Not found\n');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing environment variables');
  console.error('Please ensure .env file contains:');
  console.error('  SUPABASE_URL=...');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeMigration() {
  try {
    console.log('🔄 Starting migration: create_book_comments_system\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '024_create_book_comments_system.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Check if tables exist
    console.log('📤 Checking if tables exist...\n');
    
    const { error } = await supabase.from('book_comments').select('*').limit(1);
    
    if (error && (error.code === 'PGRST116' || error.message.includes('Could not find the table'))) {
      // Table doesn't exist
      console.log('📝 Tables do not exist. Instructions for manual execution:\n');
      console.log('==========================================');
      console.log('MANUAL MIGRATION REQUIRED');
      console.log('==========================================\n');
      console.log('1. Go to https://app.supabase.com/');
      console.log('2. Select your SomaLux project');
      console.log('3. Go to SQL Editor');
      console.log('4. Create a new query');
      console.log('5. Paste the SQL below and click RUN:\n');
      console.log(migrationSQL);
      console.log('\n==========================================\n');
      console.log('After running the SQL, restart your application.');
      process.exit(0);
    } else if (!error) {
      console.log('✅ Tables already exist!\n');
      console.log('📋 Database tables:');
      console.log('   ✓ public.book_comments');
      console.log('   ✓ public.book_comment_likes');
      console.log('   ✓ public.book_replies\n');
    } else {
      console.log('⚠️  Unable to check table status:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    const migrationPath = path.join(__dirname, 'migrations', '024_create_book_comments_system.sql');
    try {
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:');
      console.log('==========================================\n');
      console.log(migrationSQL);
      console.log('\n==========================================');
    } catch (e) {
      console.log('Unable to read migration file');
    }
  }
}

executeMigration();
