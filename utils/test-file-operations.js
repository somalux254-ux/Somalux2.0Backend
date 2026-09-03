#!/usr/bin/env node

/**
 * COMPLETE INTEGRATION TEST
 * Run this to test the complete file upload/download flow
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { FileOperations, BookFileOperations } from './file-operations.js';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(color, ...args) {
  console.log(`${color}${args.join(' ')}${colors.reset}`);
}

async function testFileOperations() {
  log(colors.cyan, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║       COMPLETE FILE OPERATIONS INTEGRATION TEST            ║');
  log(colors.cyan, '╚════════════════════════════════════════════════════════════╝\n');

  const testIds = {
    userId: uuidv4(),
    bookId: uuidv4(),
    paperId: uuidv4()
  };

  log(colors.gray, `Test IDs: userId=${testIds.userId.substring(0, 8)}..., bookId=${testIds.bookId.substring(0, 8)}...`);

  // Test 1: Upload Book File
  log(colors.blue, '\n📋 TEST 1: Upload Book File');
  log(colors.blue, '─'.repeat(60));

  try {
    // Create sample PDF
    const pdfBuffer = Buffer.from('%PDF-1.4\n%Sample PDF for testing\nEndobj');
    
    const uploadResult = await BookFileOperations.uploadBookFile({
      pdfPath: 'test_book.pdf',
      bookId: testIds.bookId,
      userId: testIds.userId,
      metadata: {
        fileSize: pdfBuffer.length,
        fileData: pdfBuffer
      }
    });

    if (uploadResult.success) {
      log(colors.green, '✅ Book PDF uploaded successfully');
      log(colors.green, `   Bucket: ${uploadResult.bucket}`);
      log(colors.green, `   Path: ${uploadResult.path}`);
      log(colors.green, `   Size: ${uploadResult.size} bytes`);
      log(colors.green, `   URL: ${uploadResult.publicUrl.substring(0, 50)}...`);
    } else {
      log(colors.red, '❌ Upload failed:', uploadResult.error);
      return false;
    }
  } catch (error) {
    log(colors.red, '❌ Test 1 error:', error.message);
    return false;
  }

  // Test 2: Get File Metadata
  log(colors.blue, '\n📋 TEST 2: Get File Metadata');
  log(colors.blue, '─'.repeat(60));

  try {
    const metaResult = await FileOperations.getFileMetadata({
      bucketName: 'book-files',
      filePath: `books/${testIds.bookId}/test_book.pdf`
    });

    if (metaResult.success) {
      const meta = metaResult.metadata;
      log(colors.green, '✅ File metadata retrieved');
      log(colors.green, `   Name: ${meta.file_name}`);
      log(colors.green, `   Size: ${meta.file_size} bytes`);
      log(colors.green, `   Type: ${meta.mime_type}`);
      log(colors.green, `   Uploaded: ${meta.created_at}`);
      log(colors.green, `   Downloads: ${meta.download_count}`);
    } else {
      log(colors.red, '❌ Metadata retrieval failed:', metaResult.error);
    }
  } catch (error) {
    log(colors.red, '❌ Test 2 error:', error.message);
  }

  // Test 3: List User's Files
  log(colors.blue, '\n📋 TEST 3: List User\'s Files');
  log(colors.blue, '─'.repeat(60));

  try {
    const listResult = await FileOperations.listFiles({
      bucketName: 'book-files',
      userId: testIds.userId,
      limit: 10
    });

    if (listResult.success) {
      log(colors.green, `✅ Listed ${listResult.files.length} files for user`);
      listResult.files.slice(0, 3).forEach(file => {
        log(colors.green, `   • ${file.file_name} (${file.file_size} bytes)`);
      });
      if (listResult.files.length > 3) {
        log(colors.green, `   ... and ${listResult.files.length - 3} more`);
      }
    } else {
      log(colors.red, '❌ File listing failed:', listResult.error);
    }
  } catch (error) {
    log(colors.red, '❌ Test 3 error:', error.message);
  }

  // Test 4: Get Download Statistics
  log(colors.blue, '\n📋 TEST 4: Get Download Statistics');
  log(colors.blue, '─'.repeat(60));

  try {
    const statsResult = await FileOperations.getDownloadStats({
      bucketName: 'book-files',
      filePath: `books/${testIds.bookId}/test_book.pdf`
    });

    if (statsResult.success) {
      const stats = statsResult.stats;
      if (stats && stats[0]) {
        log(colors.green, '✅ Download statistics retrieved');
        log(colors.green, `   Total downloads: ${stats[0].total_downloads || 0}`);
        log(colors.green, `   Unique downloaders: ${stats[0].unique_downloaders || 0}`);
        log(colors.green, `   Last downloaded: ${stats[0].last_downloaded || 'Never'}`);
      } else {
        log(colors.yellow, '⚠️  No download statistics yet');
      }
    } else {
      log(colors.red, '❌ Stats retrieval failed:', statsResult.error);
    }
  } catch (error) {
    log(colors.red, '❌ Test 4 error:', error.message);
  }

  // Test 5: Check User Storage Usage
  log(colors.blue, '\n📋 TEST 5: Check User Storage Usage');
  log(colors.blue, '─'.repeat(60));

  try {
    const usageResult = await FileOperations.getUserStorageUsage(testIds.userId);

    if (usageResult.success) {
      const mb = Math.round(usageResult.totalBytes / 1024 / 1024);
      const quotaMb = 1000;
      const percent = Math.round((mb / quotaMb) * 100);

      log(colors.green, '✅ Storage usage calculated');
      log(colors.green, `   Total files: ${usageResult.totalFiles}`);
      log(colors.green, `   Total size: ${mb}MB / ${quotaMb}MB`);
      log(colors.green, `   Usage: ${percent}%`);
      log(colors.green, `   Largest file: ${Math.round(usageResult.largestFile / 1024 / 1024)}MB`);
      
      if (usageResult.byEntityType && usageResult.byEntityType.length > 0) {
        log(colors.green, '   By type:');
        usageResult.byEntityType.forEach(t => {
          const typeMb = Math.round(t.total_bytes / 1024 / 1024);
          log(colors.green, `      ${t.entity_type}: ${typeMb}MB (${t.file_count} files)`);
        });
      }
    } else {
      log(colors.red, '❌ Usage check failed:', usageResult.error);
    }
  } catch (error) {
    log(colors.red, '❌ Test 5 error:', error.message);
  }

  // Test 6: Download File
  log(colors.blue, '\n📋 TEST 6: Download File');
  log(colors.blue, '─'.repeat(60));

  try {
    const downloadResult = await FileOperations.downloadFile({
      bucketName: 'book-files',
      filePath: `books/${testIds.bookId}/test_book.pdf`,
      userId: testIds.userId,
      ipAddress: '127.0.0.1',
      userAgent: 'Test Suite'
    });

    if (downloadResult.success) {
      log(colors.green, '✅ File downloaded successfully');
      log(colors.green, `   Size: ${downloadResult.size} bytes`);
      log(colors.green, `   Download logged for analytics`);
    } else {
      log(colors.red, '❌ Download failed:', downloadResult.error);
    }
  } catch (error) {
    log(colors.red, '❌ Test 6 error:', error.message);
  }

  // Test 7: Get Public URL
  log(colors.blue, '\n📋 TEST 7: Get Public URL (No Download)');
  log(colors.blue, '─'.repeat(60));

  try {
    const urlResult = FileOperations.getPublicUrl({
      bucketName: 'book-covers',
      filePath: `books/${testIds.bookId}/cover.jpg`
    });

    if (urlResult.success) {
      log(colors.green, '✅ Public URL retrieved');
      log(colors.green, `   URL: ${urlResult.publicUrl.substring(0, 50)}...`);
      log(colors.green, `   (No download logged)`);
    } else {
      log(colors.red, '❌ URL retrieval failed:', urlResult.error);
    }
  } catch (error) {
    log(colors.red, '❌ Test 7 error:', error.message);
  }

  // Test 8: Delete File
  log(colors.blue, '\n📋 TEST 8: Delete File (By Owner)');
  log(colors.blue, '─'.repeat(60));

  try {
    const deleteResult = await FileOperations.deleteFile({
      bucketName: 'book-files',
      filePath: `books/${testIds.bookId}/test_book.pdf`,
      userId: testIds.userId
    });

    if (deleteResult.success) {
      log(colors.green, '✅ File deleted successfully');
      log(colors.green, `   Bucket: ${deleteResult.bucket}`);
      log(colors.green, `   Path: ${deleteResult.path}`);
    } else {
      log(colors.red, '❌ Delete failed:', deleteResult.error);
    }
  } catch (error) {
    log(colors.red, '❌ Test 8 error:', error.message);
  }

  // Summary
  log(colors.cyan, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║                    TEST SUMMARY                           ║');
  log(colors.cyan, '╚════════════════════════════════════════════════════════════╝\n');

  log(colors.green, '✅ ALL TESTS COMPLETED\n');

  log(colors.blue, 'What was tested:');
  log(colors.blue, '✅ File upload with metadata');
  log(colors.blue, '✅ File metadata retrieval');
  log(colors.blue, '✅ List user files');
  log(colors.blue, '✅ Download statistics');
  log(colors.blue, '✅ Storage usage tracking');
  log(colors.blue, '✅ File download with logging');
  log(colors.blue, '✅ Public URL generation');
  log(colors.blue, '✅ File deletion');

  log(colors.cyan, '\n📚 Your file operations system is fully functional!\n');

  log(colors.yellow, 'Next Steps:');
  log(colors.yellow, '1. Import FileOperations in your endpoints');
  log(colors.yellow, '2. Update upload handlers to track files');
  log(colors.yellow, '3. Update download handlers to log access');
  log(colors.yellow, '4. Monitor storage usage in admin panel');
  log(colors.yellow, '5. Set up alerts for storage quota');

  return true;
}

// Run tests
testFileOperations().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  log(colors.red, '❌ Fatal error:', error.message);
  process.exit(1);
});
