#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://agirxwnwpxpddaqylucg.supabase.co'; // Using correct Supabase project
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const ADMIN_EMAILS = ['campuslives254@gmail.com', 'paltechsomalux@gmail.com'];

(async () => {
  try {
    console.log('Ensuring admin profiles exist...');

    for (const email of ADMIN_EMAILS) {
      console.log(`\nProcessing: ${email}`);

      // Check if user exists in auth
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error(`Failed to list users: ${listError.message}`);
        continue;
      }

      const authUser = users.find(u => u.email === email);
      if (!authUser) {
        console.log(`  ⚠️  Auth user not found for ${email}. Skipping profile check.`);
        continue;
      }

      console.log(`  ✓ Auth user found: ${authUser.id}`);

      // Check if profile exists
      const { data: profile, error: selectError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (selectError) {
        console.error(`  ✗ Error checking profile: ${selectError.message}`);
        continue;
      }

      if (profile) {
        console.log(`  ✓ Profile already exists`);
        console.log(`    - Email: ${profile.email}`);
        console.log(`    - Role: ${profile.role}`);

        // Update to admin if not already
        if (profile.role !== 'admin') {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', authUser.id);

          if (updateError) {
            console.error(`  ✗ Failed to update role to admin: ${updateError.message}`);
          } else {
            console.log(`  ✓ Updated role to admin`);
          }
        }
      } else {
        console.log(`  ⚠️  Profile does not exist, creating...`);
        
        const { error: insertError, data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            email: authUser.email,
            role: 'admin',
            full_name: authUser.email.split('@')[0],
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .maybeSingle();

        if (insertError) {
          console.error(`  ✗ Failed to create profile: ${insertError.message}`);
        } else {
          console.log(`  ✓ Profile created successfully`);
          console.log(`    - ID: ${newProfile.id}`);
          console.log(`    - Email: ${newProfile.email}`);
          console.log(`    - Role: ${newProfile.role}`);
        }
      }
    }

    console.log('\n✅ Admin profile check complete!');
    process.exit(0);
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
})();
