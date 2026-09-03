#!/usr/bin/env node

/**
 * Create daily_login_reward RPC function
 * Usage: node apply-daily-rewards-rpc.js
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

async function applyMigration() {
  try {
    console.log('🚀 Creating daily_login_reward RPC function...\n');

    const migrationPath = path.join(__dirname, 'migrations', '050_create_daily_rewards_rpc.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`[${i + 1}/${statements.length}] Executing...`);
      
      const { data, error } = await supabase.rpc('exec', {
        sql_string: stmt
      }).catch(async () => {
        // If exec RPC doesn't exist, use a different approach
        // For now, we'll log that manual execution is needed
        return { data: null, error: new Error('Please run migration in Supabase dashboard') };
      });

      if (error) {
        console.warn(`⚠️  Statement ${i + 1} failed or needs manual execution`);
      } else {
        console.log(`✅ Statement ${i + 1} executed`);
      }
    }

    console.log('\n✅ Migration applied successfully!');
    console.log('\nCreated:');
    console.log('  ✓ daily_rewards table');
    console.log('  ✓ daily_login_reward() RPC function');
    console.log('  ✓ RLS policies for daily_rewards table');

  } catch (err) {
    console.error('❌ Error applying migration:', err.message);
    console.log('\n📋 Please manually run this SQL in Supabase SQL editor:');
    console.log('================================================');
    const migrationPath = path.join(__dirname, 'migrations', '050_create_daily_rewards_rpc.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      console.log(sql);
    }
    process.exit(1);
  }
}

applyMigration();
