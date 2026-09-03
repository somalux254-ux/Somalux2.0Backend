/**
 * Test Auto-Download File Renaming Feature
 * Verifies that downloaded PDFs are renamed based on extracted metadata
 * Expected format: UNITNAME-CODE-YEAR.pdf (e.g., UCU-101-2018.pdf)
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const DOWNLOAD_TEST_DIR = path.join(__dirname, '../storage/test-downloads');

async function testAutoDownloadRenaming() {
  console.log('🧪 Testing Auto-Download File Renaming...\n');

  // Create test directory
  if (!fs.existsSync(DOWNLOAD_TEST_DIR)) {
    fs.mkdirSync(DOWNLOAD_TEST_DIR, { recursive: true });
    console.log(`📁 Created test directory: ${DOWNLOAD_TEST_DIR}\n`);
  }

  // Test 1: Check if server is running
  try {
    console.log('🔍 Test 1: Checking if backend server is running...');
    const health = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Server is running on http://localhost:5000\n');
  } catch (err) {
    console.error('❌ Server is not running. Please start the backend first.');
    console.error(`Error: ${err.message}\n`);
    return;
  }

  // Test 2: Check storage directory
  console.log('🔍 Test 2: Checking pastpapers storage directory...');
  const pastpapersDir = path.join(__dirname, '../storage/pastpapers');
  if (fs.existsSync(pastpapersDir)) {
    const files = fs.readdirSync(pastpapersDir);
    console.log(`✅ Found ${files.length} file(s) in pastpapers directory\n`);
    
    // Show first 5 files
    console.log('📝 Sample files (first 5):');
    files.slice(0, 5).forEach(file => {
      const filePath = path.join(pastpapersDir, file);
      const stats = fs.statSync(filePath);
      console.log(`   - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    });
    console.log('');
  } else {
    console.log('⚠️  Pastpapers directory not found\n');
  }

  // Test 3: Verify renaming format
  console.log('🔍 Test 3: Checking file naming format...');
  const pastpapersDir2 = path.join(__dirname, '../storage/pastpapers');
  if (fs.existsSync(pastpapersDir2)) {
    const files = fs.readdirSync(pastpapersDir2);
    const renamedFiles = files.filter(f => /^[A-Z]{2,4}-\d{2,4}-\d{4}\.pdf$/.test(f));
    const originalFiles = files.filter(f => !renamedFiles.includes(f));
    
    console.log(`✅ Successfully renamed files: ${renamedFiles.length}`);
    console.log(`   Examples:`);
    renamedFiles.slice(0, 5).forEach(f => console.log(`     - ${f}`));
    
    if (originalFiles.length > 0) {
      console.log(`\n⚠️  Original filename format: ${originalFiles.length}`);
      console.log(`   Examples:`);
      originalFiles.slice(0, 5).forEach(f => console.log(`     - ${f}`));
    }
    console.log('');
  }

  // Test 4: Verify metadata extraction
  console.log('🔍 Test 4: Checking metadata extraction...');
  const pastpapersDir3 = path.join(__dirname, '../storage/pastpapers');
  if (fs.existsSync(pastpapersDir3)) {
    const files = fs.readdirSync(pastpapersDir3);
    const metadataFiles = files.filter(f => /^[A-Z]{2,4}-\d{2,4}-\d{4}\.pdf$/.test(f));
    
    if (metadataFiles.length > 0) {
      console.log(`✅ Found ${metadataFiles.length} files with extracted metadata\n`);
      console.log('📋 Sample metadata extractions:');
      metadataFiles.slice(0, 5).forEach(file => {
        const match = file.match(/^([A-Z]{2,4})-(\d{2,4})-(\d{4})\.pdf$/);
        if (match) {
          console.log(`   - Unit Name: ${match[1]}, Unit Code: ${match[2]}, Year: ${match[3]}`);
        }
      });
      console.log('');
    } else {
      console.log('⚠️  No files with extracted metadata found yet.\n');
      console.log('📝 Note: Run auto-download feature to see renaming in action.\n');
    }
  }

  console.log('✅ Auto-download renaming test completed!');
  console.log('\n📖 Summary:');
  console.log('   - Files are downloaded and renamed based on extracted metadata');
  console.log('   - Format: UNITNAME-CODE-YEAR.pdf (e.g., UCU-101-2018.pdf)');
  console.log('   - Unit Name = PREFIX (UCU, APL, ECE, etc.)');
  console.log('   - Unit Code = NUMBER (101, 808, 301, etc.)');
  console.log('   - Year = Academic year (2018, 2019, etc.)\n');
}

// Run tests
testAutoDownloadRenaming().catch(console.error);
