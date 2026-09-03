import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import cliProgress from 'cli-progress';
import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'fs';
import path from 'path';
import { extractMetadataFromPDF, scanPDFDirectory } from '../utils/extractPDF.js';
import { fetchGoogleBooksMetadata, downloadCoverImage } from '../utils/googleBooks.js';
import { uploadBookToSupabase, bookExistsByISBN } from '../utils/supabaseUpload.js';

// Configuration
const PROGRESS_LOG_FILE = path.join(process.cwd(), 'upload-progress.json');
const BATCH_SIZE = 10;  // Process 10 books before saving progress
const DELAY_BETWEEN_REQUESTS = 1000;  // 1 second delay to avoid rate limits

/**
 * Main bulk upload orchestrator
 * @param {object} config
 * @param {string} config.booksDirectory - Path to folder containing PDFs
 * @param {string} config.supabaseUrl - Supabase URL
 * @param {string} config.supabaseKey - Supabase service role key
 * @param {string} config.googleBooksApiKey - Google Books API key (optional)
 * @param {string} config.uploadedBy - User ID (optional)
 * @param {boolean} config.skipDuplicates - Skip books that already exist
 * @returns {object} Upload statistics
 */
export async function bulkUploadBooks(config) {
  const {
    booksDirectory,
    supabaseUrl,
    supabaseKey,
    googleBooksApiKey = null,
    uploadedBy = null,
    skipDuplicates = true,
    onProgress = null,
    stopFlag = null,
    targetTable = 'books'
  } = config;

  console.log('\n🚀 Starting bulk upload process...\n');
  console.log(`📁 Source directory: ${booksDirectory}`);
  console.log(`🔑 Google Books API: ${googleBooksApiKey ? 'Enabled' : 'Disabled (using public API)'}`);
  console.log(`♻️  Skip duplicates: ${skipDuplicates ? 'Yes' : 'No'}\n`);

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  // Load progress (for resume capability)
  let progress = loadProgress();
  
  // Scan for PDFs
  console.log('🔍 Scanning for PDF files...');
  const allPdfs = await scanPDFDirectory(booksDirectory);
  console.log(`📚 Found ${allPdfs.length} PDF files\n`);

  if (allPdfs.length === 0) {
    console.log('❌ No PDF files found in the specified directory');
    return;
  }

  // Filter out already processed PDFs
  const pendingPdfs = allPdfs.filter(pdf => !progress.completed.includes(pdf));
  console.log(`⏳ Pending uploads: ${pendingPdfs.length}`);
  console.log(`✅ Already uploaded: ${progress.completed.length}\n`);

  // Statistics
  const stats = {
    total: allPdfs.length,
    processed: progress.completed.length,
    successful: progress.successful,
    failed: progress.failed.length,
    skipped: progress.skipped.length
  };

  // Notify initial scan
  if (typeof onProgress === 'function') {
    try { onProgress({ stats: { ...stats } }); } catch (_) {}
  }

  // Create progress bar
  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total} Books | Success: {success} | Failed: {failed} | Skipped: {skipped}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  progressBar.start(allPdfs.length, stats.processed, {
    success: stats.successful,
    failed: stats.failed,
    skipped: stats.skipped
  });

  // Process each PDF
  for (let i = 0; i < pendingPdfs.length; i++) {
    // Check if stop was requested
    if (stopFlag && stopFlag.stopped) {
      console.log('\n⏸️ Upload stopped by user request\n');
      saveProgress(progress);
      break;
    }

    const pdfPath = pendingPdfs[i];
    const filename = path.basename(pdfPath);

    try {
      // Step 1: Extract ISBN or Title from PDF
      const extracted = await extractMetadataFromPDF(pdfPath);
      
      // Step 2: Check for duplicates if enabled
      if (skipDuplicates && extracted.isbn) {
        const exists = await bookExistsByISBN(extracted.isbn, supabase);
        if (exists) {
          progress.skipped.push(pdfPath);
          stats.skipped++;
          progressBar.update(++stats.processed, {
            success: stats.successful,
            failed: stats.failed,
            skipped: stats.skipped
          });
          if (typeof onProgress === 'function') {
            try { onProgress({ stats: { ...stats } }); } catch (_) {}
          }
          continue;
        }
      }

      // Step 3: Fetch metadata from Google Books
      const query = extracted.isbn || extracted.title;
      const metadataFromApi = await fetchGoogleBooksMetadata(query, googleBooksApiKey);

      // If Google Books lookup fails, fall back to minimal metadata so we still create a submission
      const effectiveMetadata = metadataFromApi || {
        title: extracted.title || path.basename(pdfPath, path.extname(pdfPath)),
        author: extracted.author || 'Unknown',
        description: '',
        isbn: extracted.isbn || '',
        published_year: null,
        publisher: '',
        pages: 0,
        language: 'en',
        cover_image_url: null,
      };

      // Step 4: Download cover image if available
      let coverBuffer = null;
      if (effectiveMetadata.cover_image_url) {
        coverBuffer = await downloadCoverImage(effectiveMetadata.cover_image_url);
      }

      // Step 5: Upload to Supabase
      await uploadBookToSupabase({
        pdfPath,
        coverBuffer,
        metadata: effectiveMetadata,
        supabaseClient: supabase,
        uploadedBy,
        targetTable
      });

      // Mark as successful
      progress.completed.push(pdfPath);
      stats.successful++;
      stats.processed++;

      progressBar.update(stats.processed, {
        success: stats.successful,
        failed: stats.failed,
        skipped: stats.skipped
      });
      if (typeof onProgress === 'function') {
        try { onProgress({ stats: { ...stats } }); } catch (_) {}
      }

      // Save progress every BATCH_SIZE books
      if ((i + 1) % BATCH_SIZE === 0) {
        saveProgress(progress);
      }

      // Rate limiting delay
      if (i < pendingPdfs.length - 1) {
        await delay(DELAY_BETWEEN_REQUESTS);
      }

    } catch (error) {
      // Log detailed error for debugging
      const errorMsg = error.message || '';
      const filename = path.basename(pdfPath);
      
      console.error(`🔴 Error uploading ${filename}:`, errorMsg);
      console.error(`   Full error:`, error);
      
      // Also write to file for persistence
      try {
        const logFile = path.join(process.cwd(), 'bulk-upload-errors.log');
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${filename}: ${errorMsg}\nStack: ${error.stack}\n---\n`;
        appendFileSync(logFile, logEntry, 'utf8');
      } catch (logErr) {
        console.error('Failed to write to error log:', logErr.message);
      }
      
      // Check if this is a known encryption error
      if (errorMsg.includes('signature verification') || 
          errorMsg.includes('encrypted') || 
          errorMsg.includes('Invalid PDF')) {
        // Still count as failed but provide clear reason
        progress.failed.push({ 
          path: pdfPath, 
          reason: `PDF upload failed: ${errorMsg}` 
        });
      } else {
        progress.failed.push({ path: pdfPath, reason: error.message });
      }
      
      stats.failed++;
      progressBar.update(++stats.processed, {
        success: stats.successful,
        failed: stats.failed,
        skipped: stats.skipped
      });
      if (typeof onProgress === 'function') {
        try { onProgress({ stats: { ...stats } }); } catch (_) {}
      }
    }
  }

  progressBar.stop();

  // Save final progress
  saveProgress(progress);

  // Print summary
  console.log('\n\n📊 Upload Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Successful uploads: ${stats.successful}`);
  console.log(`❌ Failed uploads: ${stats.failed}`);
  console.log(`⏭️  Skipped (duplicates): ${stats.skipped}`);
  console.log(`📚 Total processed: ${stats.processed}/${stats.total}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (progress.failed.length > 0) {
    console.log('❌ Failed uploads details:');
    progress.failed.slice(0, 10).forEach((fail, idx) => {
      console.log(`   ${idx + 1}. ${path.basename(fail.path)}: ${fail.reason}`);
    });
    if (progress.failed.length > 10) {
      console.log(`   ... and ${progress.failed.length - 10} more`);
    }
    console.log('');
  }

  console.log('✨ Bulk upload completed!\n');

  // Final notify
  if (typeof onProgress === 'function') {
    try { onProgress({ stats: { ...stats }, completed: true }); } catch (_) {}
  }
  return stats;
}

/**
 * Load progress from file (for resume capability)
 */
function loadProgress() {
  if (existsSync(PROGRESS_LOG_FILE)) {
    try {
      const data = readFileSync(PROGRESS_LOG_FILE, 'utf8');
      const progress = JSON.parse(data);
      console.log('📂 Loaded existing progress from previous session');
      return progress;
    } catch (error) {
      console.warn('⚠️ Could not load progress file, starting fresh');
    }
  }
  
  return {
    completed: [],
    failed: [],
    skipped: [],
    successful: 0,
    startedAt: new Date().toISOString()
  };
}

/**
 * Save progress to file
 */
function saveProgress(progress) {
  try {
    progress.lastSavedAt = new Date().toISOString();
    writeFileSync(PROGRESS_LOG_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.warn('⚠️ Could not save progress:', error.message);
  }
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CLI runner (if executed directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  const booksDirectory = process.argv[2] || process.env.BOOKS_DIRECTORY;
  
  if (!booksDirectory) {
    console.error('❌ Error: Books directory not specified');
    console.log('\nUsage:');
    console.log('  node bulkUpload.js <path-to-books-directory>');
    console.log('  or set BOOKS_DIRECTORY in .env file\n');
    process.exit(1);
  }

  const config = {
    booksDirectory,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY || null,
    uploadedBy: null,
    skipDuplicates: true
  };

  if (!config.supabaseUrl || !config.supabaseKey) {
    console.error('❌ Error: Supabase credentials missing in .env file');
    console.log('Required environment variables:');
    console.log('  - SUPABASE_URL');
    console.log('  - SUPABASE_SERVICE_ROLE_KEY');
    console.log('  - GOOGLE_BOOKS_API_KEY (optional)\n');
    process.exit(1);
  }

  bulkUploadBooks(config).catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}
