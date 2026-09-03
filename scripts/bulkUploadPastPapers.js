import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import cliProgress from 'cli-progress';
import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'fs';
import path from 'path';
import { extractPastPaperDetailsFromScannedPDF, parseFileNameForPastPaper } from '../utils/ocrExtractPDF.js';
import { uploadPastPaperToSupabase } from '../utils/supabaseUpload.js';

// Configuration
const PROGRESS_LOG_FILE = path.join(process.cwd(), 'upload-progress-pastpapers.json');
const BATCH_SIZE = 5; // Process 5 papers before saving progress (OCR is slow)
const DELAY_BETWEEN_REQUESTS = 2000; // 2 second delay between OCR operations

/**
 * Main bulk upload orchestrator for past papers
 * @param {object} config
 * @param {string} config.papersDirectory - Path to folder containing PDFs
 * @param {string} config.supabaseUrl - Supabase URL
 * @param {string} config.supabaseKey - Supabase service role key
 * @param {string} config.universityId - University ID (required)
 * @param {string} config.uploadedBy - User ID (optional)
 * @param {boolean} config.asSubmission - Whether to submit for approval
 * @param {function} config.onProgress - Progress callback
 * @param {object} config.stopFlag - Stop flag object
 * @returns {object} Upload statistics
 */
export async function bulkUploadPastPapers(config) {
  const {
    papersDirectory,
    supabaseUrl,
    supabaseKey,
    universityId = null,
    uploadedBy = null,
    asSubmission = false,
    onProgress = null,
    stopFlag = null
  } = config;

  console.log('\n🚀 Starting past papers bulk upload process...\n');
  console.log(`📁 Source directory: ${papersDirectory}`);
  console.log(`📄 OCR Enabled: Yes`);
  console.log(`♻️  Submission Mode: ${asSubmission ? 'Yes' : 'No'}\n`);

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  // Load progress (for resume capability)
  let progress = loadProgress();
  
  // Scan for PDFs
  console.log('🔍 Scanning for PDF files...');
  const allPdfs = await scanPDFDirectory(papersDirectory);
  console.log(`📚 Found ${allPdfs.length} PDF files\n`);

  if (allPdfs.length === 0) {
    console.log('❌ No PDF files found in the specified directory');
    return {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };
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
    format: 'Progress |{bar}| {percentage}% | {value}/{total} Papers | Success: {success} | Failed: {failed}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  progressBar.start(allPdfs.length, stats.processed, {
    success: stats.successful,
    failed: stats.failed
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
    const fileName = path.basename(pdfPath);

    try {
      // Step 1: Read PDF buffer
      const { readFileSync } = await import('fs');
      const pdfBuffer = readFileSync(pdfPath);

      // Step 2: Extract past paper details using OCR
      console.log(`\n🔄 Processing: ${fileName}`);
      const details = await extractPastPaperDetailsFromScannedPDF(pdfBuffer, fileName);

      // Step 3: Validate extracted details
      if (!details.unit_code && !details.unit_name) {
        console.warn(`⚠️ Could not extract unit code or name for ${fileName}`);
        progress.failed.push(pdfPath);
        stats.failed++;
        progressBar.update(++stats.processed, {
          success: stats.successful,
          failed: stats.failed
        });
        if (typeof onProgress === 'function') {
          try { onProgress({ stats: { ...stats } }); } catch (_) {}
        }
        continue;
      }

      // Step 4: Upload to Supabase
      console.log(`📤 Uploading to Supabase...`);
      const result = await uploadPastPaperToSupabase({
        supabase,
        pdfBuffer,
        fileName,
        details: {
          ...details,
          university_id: universityId,
          uploaded_by: uploadedBy,
          is_submission: asSubmission
        }
      });

      progress.completed.push(pdfPath);
      stats.successful++;
      console.log(`✅ Uploaded: ${fileName}`);
      
      progressBar.update(++stats.processed, {
        success: stats.successful,
        failed: stats.failed
      });

      // Save progress every BATCH_SIZE
      if (stats.processed % BATCH_SIZE === 0) {
        saveProgress(progress);
      }

      // Delay before next request (OCR is slow)
      if (i < pendingPdfs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }

      // Notify progress
      if (typeof onProgress === 'function') {
        try { onProgress({ stats: { ...stats } }); } catch (_) {}
      }

    } catch (error) {
      console.error(`❌ Failed to process ${fileName}:`, error.message);
      progress.failed.push(pdfPath);
      stats.failed++;
      progressBar.update(++stats.processed, {
        success: stats.successful,
        failed: stats.failed
      });
      if (typeof onProgress === 'function') {
        try { onProgress({ stats: { ...stats } }); } catch (_) {}
      }
    }
  }

  progressBar.stop();
  console.log('\n✅ Upload process complete!\n');
  console.log(`Total: ${stats.total}`);
  console.log(`Successful: ${stats.successful}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Skipped: ${stats.skipped}\n`);

  // Save final progress
  saveProgress(progress);

  return stats;
}

/**
 * Scan directory for all PDFs recursively
 */
export async function scanPDFDirectory(baseDir) {
  const { readdirSync, statSync } = await import('fs');
  const pdfs = [];

  function scanDir(dir) {
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        try {
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDir(fullPath);  // Recursive
          } else if (stat.isFile() && item.toLowerCase().endsWith('.pdf')) {
            pdfs.push(fullPath);
          }
        } catch (err) {
          console.warn(`⚠️ Skipping ${fullPath}:`, err.message);
        }
      }
    } catch (err) {
      console.error(`❌ Cannot read directory ${dir}:`, err.message);
    }
  }

  scanDir(baseDir);
  return pdfs;
}

/**
 * Load progress from file
 */
function loadProgress() {
  if (existsSync(PROGRESS_LOG_FILE)) {
    try {
      const data = readFileSync(PROGRESS_LOG_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.warn('Could not load progress file, starting fresh');
    }
  }

  return {
    completed: [],
    failed: [],
    skipped: [],
    successful: 0
  };
}

/**
 * Save progress to file
 */
function saveProgress(progress) {
  try {
    writeFileSync(PROGRESS_LOG_FILE, JSON.stringify(progress, null, 2));
  } catch (err) {
    console.error('Failed to save progress:', err.message);
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = {
    papersDirectory: process.argv[2] || './scanned-papers',
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    uploadedBy: null,
    asSubmission: false,
    onProgress: (data) => console.log(`Progress: ${data.stats.processed}/${data.stats.total}`)
  };

  bulkUploadPastPapers(config).catch(error => {
    console.error('Bulk upload failed:', error);
    process.exit(1);
  });
}
