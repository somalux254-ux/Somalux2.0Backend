#!/usr/bin/env node

/**
 * Apply Migration 013: Create university_ratings table
 * Direct approach without dotenv
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables directly from .env file
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env file not found at ${envPath}`);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return envVars;
}

async function runMigration() {
  try {
    // Load environment variables
    const env = loadEnv();
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not found in .env');
      process.exit(1);
    }
    
    console.log('🔄 Running Migration 013: Create university_ratings table...\n');
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'backend', 'migrations', '013_create_university_ratings.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by statements
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
        // Execute raw SQL
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.error(`❌ Statement ${i + 1} failed: ${error.message}`);
          console.error(`   ${stmtDescription}\n`);
          errorCount++;
        } else {
          console.log(`✅ Statement ${i + 1}/${statements.length}`);
          successCount++;
        }
      } catch (e) {
        console.error(`❌ Statement ${i + 1} error: ${e.message}`);
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Results: ${successCount} succeeded, ${errorCount} failed`);
    console.log('='.repeat(60) + '\n');
    
    if (errorCount === 0) {
      console.log('✅ Migration 013 completed successfully!\n');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
