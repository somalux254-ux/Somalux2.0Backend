#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://agirxwnwpxpddaqylucg.supabase.co'; // Using correct Supabase project
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

(async () => {
  try {
    console.log('Checking profiles table schema...');
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error:', error.message);
    } else {
      if (data && data.length > 0) {
        console.log('Sample profile record:');
        console.log(JSON.stringify(data[0], null, 2));
      } else {
        console.log('No profiles found. Checking table structure via query...');
        // We can't directly get schema, so let's just list the columns we can see
        const { data: allProfiles, error: selectError } = await supabase
          .from('profiles')
          .select('*')
          .limit(0);
        
        console.log('Error (expected):', selectError?.message);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
})();
