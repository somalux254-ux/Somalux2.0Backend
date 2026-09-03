/**
 * FILE OPERATIONS QUICK REFERENCE
 * Common code examples for upload/download/manage files
 */

// ============================================
// IMPORT
// ============================================

import { 
  FileOperations,
  BookFileOperations,
  PastPaperFileOperations,
  AvatarFileOperations
} from './file-operations.js';

// ============================================
// 1. UPLOAD A BOOK
// ============================================

// Example 1: Upload book PDF
async function uploadBook(bookId, pdfBuffer, userId) {
  const result = await BookFileOperations.uploadBookFile({
    pdfPath: `book_${bookId}.pdf`,
    bookId: bookId,
    userId: userId,
    metadata: {
      fileSize: pdfBuffer.length,
      fileData: pdfBuffer
    }
  });

  if (result.success) {
    console.log('Book uploaded:', result.publicUrl);
    return result;
  } else {
    throw new Error(result.error);
  }
}

// Example 2: Upload book with cover
async function uploadBookWithCover(bookId, pdfBuffer, coverBuffer, userId) {
  // Upload PDF
  const pdfResult = await BookFileOperations.uploadBookFile({
    pdfPath: `book_${bookId}.pdf`,
    bookId: bookId,
    userId: userId,
    metadata: {
      fileSize: pdfBuffer.length,
      fileData: pdfBuffer
    }
  });

  // Upload cover
  const coverResult = await BookFileOperations.uploadBookCover({
    bookId: bookId,
    userId: userId,
    imageData: coverBuffer,
    mimeType: 'image/jpeg'
  });

  return {
    pdf: pdfResult.publicUrl,
    cover: coverResult.publicUrl
  };
}

// ============================================
// 2. DOWNLOAD A FILE
// ============================================

// Example 3: Download book file (Express route)
app.get('/api/books/:id/download', async (req, res) => {
  try {
    const book = await getBook(req.params.id);
    
    const download = await FileOperations.downloadFile({
      bucketName: 'book-files',
      filePath: book.file_path,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    if (download.success) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${book.title}.pdf"`);
      res.send(download.data);
    } else {
      res.status(500).json({ error: download.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Example 4: Stream large file (more efficient)
app.get('/api/books/:id/stream', async (req, res) => {
  try {
    const book = await getBook(req.params.id);
    
    // Get file stream URL
    const { publicUrl } = FileOperations.getPublicUrl({
      bucketName: 'book-files',
      filePath: book.file_path
    });

    // Log download
    const fileRecord = await FileOperations.getFileMetadata({
      bucketName: 'book-files',
      filePath: book.file_path
    });

    if (fileRecord.success) {
      // Log download asynchronously
      FileOperations.downloadFile({
        bucketName: 'book-files',
        filePath: book.file_path,
        userId: req.user?.id
      }).catch(console.error);
    }

    // Redirect to public URL
    res.redirect(publicUrl);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 3. GET FILE INFORMATION
// ============================================

// Example 5: Get file metadata
async function getFileInfo(bucketName, filePath) {
  const result = await FileOperations.getFileMetadata({
    bucketName: bucketName,
    filePath: filePath
  });

  if (result.success) {
    const { metadata } = result;
    console.log({
      fileName: metadata.file_name,
      size: metadata.file_size,
      uploaded: metadata.created_at,
      downloads: metadata.download_count,
      lastAccessed: metadata.last_accessed_at,
      uploadedBy: metadata.profiles?.full_name
    });
  }
}

// Example 6: Get download statistics
async function getDownloadStats(bucketName, filePath) {
  const result = await FileOperations.getDownloadStats({
    bucketName: bucketName,
    filePath: filePath
  });

  if (result.success) {
    const { stats } = result;
    console.log({
      totalDownloads: stats.total_downloads,
      uniqueDownloaders: stats.unique_downloaders,
      lastDownloaded: stats.last_downloaded
    });
  }
}

// ============================================
// 4. LIST FILES
// ============================================

// Example 7: List user's uploaded books
async function getUserBooks(userId) {
  const result = await FileOperations.listFiles({
    bucketName: 'book-files',
    entityType: 'book',
    userId: userId,
    limit: 20
  });

  if (result.success) {
    console.log('User books:', result.files);
    return result.files;
  }
}

// Example 8: List all past papers (with pagination)
async function getAllPapers(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  
  const result = await FileOperations.listFiles({
    bucketName: 'past-papers',
    entityType: 'past_paper',
    limit: pageSize,
    offset: offset
  });

  return result.files;
}

// ============================================
// 5. DELETE FILES
// ============================================

// Example 9: Delete user's own file
async function deleteMyFile(bucketName, filePath, userId) {
  const result = await FileOperations.deleteFile({
    bucketName: bucketName,
    filePath: filePath,
    userId: userId // Only owner can delete
  });

  if (result.success) {
    console.log('File deleted');
  } else {
    console.error('Delete failed:', result.error);
  }
}

// Example 10: Admin delete any file
async function adminDeleteFile(bucketName, filePath) {
  const result = await FileOperations.deleteFile({
    bucketName: bucketName,
    filePath: filePath,
    userId: null // Admin bypass
  });

  return result;
}

// ============================================
// 6. STORAGE QUOTAS
// ============================================

// Example 11: Check user's storage usage
async function checkStorageUsage(userId) {
  const usage = await FileOperations.getUserStorageUsage(userId);

  if (usage.success) {
    const usedMB = Math.round(usage.totalBytes / 1024 / 1024);
    const quotaMB = 1000; // 1GB per user
    const percentUsed = Math.round((usedMB / quotaMB) * 100);

    console.log({
      usedMB,
      quotaMB,
      percentUsed,
      totalFiles: usage.totalFiles,
      largestFile: Math.round(usage.largestFile / 1024 / 1024) + 'MB'
    });

    // Alert if over 80%
    if (percentUsed > 80) {
      console.warn(`⚠️ User is using ${percentUsed}% of storage quota`);
    }
  }
}

// Example 12: Check if user can upload more
async function canUserUpload(userId, fileSize) {
  const usage = await FileOperations.getUserStorageUsage(userId);
  const quotaBytes = 1000 * 1024 * 1024; // 1GB

  const totalAfterUpload = usage.totalBytes + fileSize;
  return totalAfterUpload <= quotaBytes;
}

// ============================================
// 7. UPLOAD WITH VALIDATION
// ============================================

// Example 13: Upload with size validation
async function uploadBookSafe(bookId, pdfBuffer, userId) {
  const MAX_SIZE = 500 * 1024 * 1024; // 500MB

  if (pdfBuffer.length > MAX_SIZE) {
    throw new Error(`File too large: ${pdfBuffer.length} > ${MAX_SIZE}`);
  }

  // Check storage quota
  const canUpload = await canUserUpload(userId, pdfBuffer.length);
  if (!canUpload) {
    throw new Error('Storage quota exceeded');
  }

  return BookFileOperations.uploadBookFile({
    pdfPath: `book_${bookId}.pdf`,
    bookId: bookId,
    userId: userId,
    metadata: {
      fileSize: pdfBuffer.length,
      fileData: pdfBuffer
    }
  });
}

// Example 14: Upload with error handling
async function uploadWithRetry(uploadFn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Upload attempt ${attempt}/${maxRetries}`);
      return await uploadFn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retry
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// ============================================
// 8. UPLOAD AVATAR
// ============================================

// Example 15: Upload user profile avatar
async function uploadUserAvatar(userId, imageBuffer, mimeType = 'image/jpeg') {
  const result = await AvatarFileOperations.uploadAvatar({
    userId: userId,
    imageData: imageBuffer,
    mimeType: mimeType
  });

  if (result.success) {
    // Update user profile
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: result.publicUrl })
      .eq('id', userId);

    if (error) throw error;
    return result.publicUrl;
  }
}

// ============================================
// 9. UPLOAD PAST PAPER
// ============================================

// Example 16: Upload past paper
async function uploadPastPaper(paperId, pdfBuffer, userId) {
  const result = await PastPaperFileOperations.uploadPastPaper({
    pdfPath: `paper_${paperId}.pdf`,
    paperId: paperId,
    userId: userId,
    metadata: {
      fileSize: pdfBuffer.length,
      fileData: pdfBuffer
    }
  });

  return result;
}

// ============================================
// 10. MIDDLEWARE FOR FILE OPERATIONS
// ============================================

// Example 18: Express middleware for file uploads
function validateFileUpload(maxSize = 500 * 1024 * 1024) {
  return async (req, res, next) => {
    try {
      // Check content-length header
      const contentLength = parseInt(req.headers['content-length'], 10);
      
      if (contentLength > maxSize) {
        return res.status(413).json({
          error: `File too large: ${contentLength} > ${maxSize}`
        });
      }

      // Check user quota
      const canUpload = await canUserUpload(req.user.id, contentLength);
      if (!canUpload) {
        return res.status(507).json({
          error: 'Storage quota exceeded'
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}

// Example 19: Rate limit file downloads
function rateLimitDownloads(maxPerHour = 100) {
  const userDownloads = new Map();

  return (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    const now = Date.now();
    const hour = Math.floor(now / (1000 * 60 * 60));
    const key = `${userId}:${hour}`;

    const downloads = userDownloads.get(key) || 0;
    
    if (downloads >= maxPerHour) {
      return res.status(429).json({
        error: 'Download rate limit exceeded'
      });
    }

    userDownloads.set(key, downloads + 1);

    // Cleanup old entries
    if (userDownloads.size > 10000) {
      userDownloads.clear();
    }

    next();
  };
}

// ============================================
// 12. PRODUCTION PATTERNS
// ============================================

// Example 20: Production-ready upload endpoint
app.post('/api/books/upload', validateFileUpload(), async (req, res) => {
  const uploadId = uuidv4();
  console.log(`[${uploadId}] Starting book upload`);

  try {
    // 1. Extract data
    const bookId = req.body.bookId;
    const pdfBuffer = req.file.buffer;
    const userId = req.user.id;

    // 2. Validate
    if (!bookId || !pdfBuffer) {
      return res.status(400).json({ error: 'Missing bookId or file' });
    }

    // 3. Check quota
    const canUpload = await canUserUpload(userId, pdfBuffer.length);
    if (!canUpload) {
      return res.status(507).json({ error: 'Storage quota exceeded' });
    }

    // 4. Upload with retry
    console.log(`[${uploadId}] Uploading to storage`);
    const result = await uploadWithRetry(() =>
      BookFileOperations.uploadBookFile({
        pdfPath: `book_${bookId}.pdf`,
        bookId: bookId,
        userId: userId,
        metadata: {
          fileSize: pdfBuffer.length,
          fileData: pdfBuffer
        }
      })
    );

    // 5. Update database
    console.log(`[${uploadId}] Updating database`);
    const { error: dbError } = await supabase
      .from('books')
      .update({ file_path: result.path })
      .eq('id', bookId);

    if (dbError) throw dbError;

    // 6. Log success
    console.log(`[${uploadId}] Upload complete`);
    res.json({
      success: true,
      bookId: bookId,
      fileUrl: result.publicUrl,
      size: pdfBuffer.length
    });

  } catch (error) {
    console.error(`[${uploadId}] Upload failed:`, error);
    res.status(500).json({ error: error.message });
  }
});

export {
  uploadBook,
  uploadBookWithCover,
  getFileInfo,
  getDownloadStats,
  getUserBooks,
  getAllPapers,
  deleteMyFile,
  adminDeleteFile,
  checkStorageUsage,
  canUserUpload,
  uploadBookSafe,
  uploadWithRetry,
  uploadUserAvatar,
  uploadPastPaper,
  validateFileUpload,
  rateLimitDownloads
};
