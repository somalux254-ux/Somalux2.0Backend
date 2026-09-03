#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function checkTables() {
  try {
    console.log('🔍 Checking email notification tables in Supabase...\n');

    // Check admin_notifications table
    console.log('1️⃣  Checking admin_notifications table...');
    const { data: adminNotif, error: notifError } = await supabase
      .from('admin_notifications')
      .select('*')
      .limit(1);
    
    if (notifError && notifError.code === 'PGRST116') {
      console.log('   ❌ Table does NOT exist: admin_notifications');
      console.log(`      Error: ${notifError.message}`);
    } else if (notifError) {
      console.log(`   ⚠️  Error querying: ${notifError.message}`);
    } else {
      console.log('   ✅ Table EXISTS: admin_notifications');
    }

    // Check admin_notification_logs table
    console.log('\n2️⃣  Checking admin_notification_logs table...');
    const { data: logs, error: logsError } = await supabase
      .from('admin_notification_logs')
      .select('*')
      .limit(1);
    
    if (logsError && logsError.code === 'PGRST116') {
      console.log('   ❌ Table does NOT exist: admin_notification_logs');
      console.log(`      Error: ${logsError.message}`);
    } else if (logsError) {
      console.log(`   ⚠️  Error querying: ${logsError.message}`);
    } else {
      console.log('   ✅ Table EXISTS: admin_notification_logs');
    }

    // Check email_templates table
    console.log('\n3️⃣  Checking email_templates table...');
    const { data: templates, error: templatesError } = await supabase
      .from('email_templates')
      .select('*')
      .limit(1);
    
    if (templatesError && templatesError.code === 'PGRST116') {
      console.log('   ❌ Table does NOT exist: email_templates');
      console.log(`      Error: ${templatesError.message}`);
    } else if (templatesError) {
      console.log(`   ⚠️  Error querying: ${templatesError.message}`);
    } else {
      console.log('   ✅ Table EXISTS: email_templates');
    }

    console.log('\n' + '='.repeat(60));
    console.log('RESULT: If all tables show ✅, your database is properly set up.');
    console.log('If any show ❌, you need to run the SQL migration.');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

checkTables();
