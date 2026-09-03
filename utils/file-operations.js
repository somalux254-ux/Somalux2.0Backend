/**
 * Complete File Operations Integration
 * Upload, download, and manage files with Supabase Storage
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Initialize Supabase client for file operations
 */
export function createSupabaseStorageClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

// ============================================
// FILE OPERATIONS
// ============================================

export const FileOperations = {
  
  /**
   * Upload file to Supabase Storage
   * @param {string} bucketName - Storage bucket name
   * @param {string} filePath - Path where file will be stored
   * @param {Buffer|File} fileData - File data
   * @param {object} metadata - File metadata for database
   * @returns {object} Upload result with URLs and metadata
   */
  async uploadFile({ bucketName, filePath, fileData, metadata = {} }) {
    try {
      const supabase = createSupabaseStorageClient();

      // Determine content type
      let contentType = metadata.mimeType || 'application/octet-stream';
      if (filePath.endsWith('.pdf')) contentType = 'application/pdf';
      if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
      if (filePath.endsWith('.png')) contentType = 'image/png';

      // Upload file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileData, {
          contentType,
          upsert: metadata.upsert || false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      // Log file upload to database
      if (metadata.userId) {
        const { error: logError } = await supabase
          .rpc('log_file_upload', {
            p_bucket: bucketName,
            p_file_path: filePath,
            p_file_name: metadata.fileName || filePath.split('/').pop(),
            p_file_size: metadata.fileSize || 0,
            p_mime_type: contentType,
            p_uploader_id: metadata.userId,
            p_entity_type: metadata.entityType || 'other',
            p_entity_id: metadata.entityId || null,
            p_is_public: metadata.isPublic || false
          });

        if (logError) {
          console.warn('Failed to log upload:', logError);
        }
      }

      return {
        success: true,
        bucket: bucketName,
        path: uploadData.path,
        fullPath: uploadData.fullPath,
        publicUrl: urlData.publicUrl,
        size: metadata.fileSize || 0
      };

    } catch (error) {
      console.error('File upload error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Download file from Supabase Storage
   * @param {string} bucketName - Storage bucket name
   * @param {string} filePath - Path to file in storage
   * @param {string} userId - User downloading (for tracking)
   * @returns {object} Download result with file data
   */
  async downloadFile({ bucketName, filePath, userId = null, ipAddress = null, userAgent = null }) {
    try {
      const supabase = createSupabaseStorageClient();

      // Get file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (downloadError) {
        throw new Error(`Download failed: ${downloadError.message}`);
      }

      // Get file metadata from database
      const { data: fileRecord } = await supabase
        .from('file_uploads')
        .select('id')
        .eq('file_path', filePath)
        .eq('bucket_name', bucketName)
        .single();

      // Log download
      if (fileRecord) {
        const { error: logError } = await supabase
          .rpc('log_file_download', {
            p_file_id: fileRecord.id,
            p_downloader_id: userId || null,
            p_ip_address: ipAddress || null,
            p_user_agent: userAgent || null
          });

        if (logError) {
          console.warn('Failed to log download:', logError);
        }
      }

      return {
        success: true,
        bucket: bucketName,
        path: filePath,
        data: fileData,
        size: fileData.size
      };

    } catch (error) {
      console.error('File download error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete file from storage and database
   * @param {string} bucketName - Storage bucket name
   * @param {string} filePath - Path to file in storage
   * @param {string} userId - User deleting (for validation)
   * @returns {object} Delete result
   */
  async deleteFile({ bucketName, filePath, userId = null }) {
    try {
      const supabase = createSupabaseStorageClient();

      // Get file record for validation
      const { data: fileRecord, error: queryError } = await supabase
        .from('file_uploads')
        .select('id, uploaded_by')
        .eq('file_path', filePath)
        .eq('bucket_name', bucketName)
        .single();

      if (queryError || !fileRecord) {
        throw new Error('File record not found');
      }

      // Validate user owns the file
      if (userId && fileRecord.uploaded_by !== userId) {
        throw new Error('Permission denied: Cannot delete file uploaded by another user');
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) {
        throw new Error(`Storage deletion failed: ${storageError.message}`);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .rpc('delete_file_record', {
          p_file_id: fileRecord.id
        });

      if (dbError) {
        console.warn('Failed to delete file record:', dbError);
      }

      return {
        success: true,
        bucket: bucketName,
        path: filePath
      };

    } catch (error) {
      console.error('File deletion error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get file metadata
   * @param {string} bucketName - Storage bucket name
   * @param {string} filePath - Path to file in storage
   * @returns {object} File metadata
   */
  async getFileMetadata({ bucketName, filePath }) {
    try {
      const supabase = createSupabaseStorageClient();

      const { data: metadata, error } = await supabase
        .from('file_uploads')
        .select(`
          id,
          file_name,
          file_size,
          mime_type,
          uploaded_by,
          entity_type,
          entity_id,
          download_count,
          created_at,
          last_accessed_at,
          profiles:uploaded_by(full_name, email)
        `)
        .eq('file_path', filePath)
        .eq('bucket_name', bucketName)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        metadata
      };

    } catch (error) {
      console.error('Error getting metadata:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get download statistics for a file
   * @param {string} filePath - Path to file in storage
   * @returns {object} Download stats
   */
  async getDownloadStats({ bucketName, filePath }) {
    try {
      const supabase = createSupabaseStorageClient();

      // Get file ID
      const { data: fileRecord } = await supabase
        .from('file_uploads')
        .select('id')
        .eq('file_path', filePath)
        .eq('bucket_name', bucketName)
        .single();

      if (!fileRecord) {
        throw new Error('File not found');
      }

      // Get download stats
      const { data: stats, error } = await supabase
        .rpc('get_file_download_stats', {
          p_file_id: fileRecord.id
        });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        stats
      };

    } catch (error) {
      console.error('Error getting download stats:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * List files in a bucket with filters
   * @param {string} bucketName - Storage bucket name
   * @param {object} options - Filter options
   * @returns {array} Files list
   */
  async listFiles({ bucketName, entityType = null, userId = null, limit = 100, offset = 0 }) {
    try {
      const supabase = createSupabaseStorageClient();

      let query = supabase
        .from('file_uploads')
        .select('*')
        .eq('bucket_name', bucketName);

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      if (userId) {
        query = query.eq('uploaded_by', userId);
      }

      const { data: files, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        files: files || []
      };

    } catch (error) {
      console.error('Error listing files:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get user's storage usage
   * @param {string} userId - User ID
   * @returns {object} Storage usage stats
   */
  async getUserStorageUsage(userId) {
    try {
      const supabase = createSupabaseStorageClient();

      const { data: usage, error } = await supabase
        .rpc('get_user_storage_usage', {
          p_user_id: userId
        });

      if (error) {
        throw new Error(error.message);
      }

      // Parse JSONB data if it comes as string
      let byEntityType = usage.by_entity_type || [];
      if (typeof byEntityType === 'string') {
        byEntityType = JSON.parse(byEntityType);
      }

      return {
        success: true,
        totalBytes: usage.total_bytes || 0,
        totalFiles: usage.total_files || 0,
        largestFile: usage.largest_file || 0,
        byEntityType: byEntityType
      };

    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get public file URL (without downloading)
   * @param {string} bucketName - Storage bucket name
   * @param {string} filePath - Path to file in storage
   * @returns {string} Public URL
   */
  getPublicUrl({ bucketName, filePath }) {
    try {
      const supabase = createSupabaseStorageClient();
      
      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return {
        success: true,
        publicUrl: data.publicUrl
      };

    } catch (error) {
      console.error('Error getting public URL:', error);
      return { success: false, error: error.message };
    }
  }
};

// ============================================
// SPECIALIZED FILE OPERATIONS
// ============================================

export const BookFileOperations = {
  
  /**
   * Upload a book file (PDF)
   */
  async uploadBookFile({ pdfPath, bookId, userId, metadata = {} }) {
    const fileName = pdfPath.split('/').pop();
    const filePath = `books/${bookId}/${fileName}`;
    const fileSize = metadata.fileSize || 0;

    return FileOperations.uploadFile({
      bucketName: 'book-files',
      filePath,
      fileData: metadata.fileData,
      metadata: {
        fileName,
        fileSize,
        userId,
        entityType: 'book',
        entityId: bookId,
        mimeType: 'application/pdf',
        isPublic: false
      }
    });
  },

  /**
   * Upload book cover image
   */
  async uploadBookCover({ coverId, bookId, userId, imageData, mimeType = 'image/jpeg' }) {
    const filePath = `books/${bookId}/cover.jpg`;

    return FileOperations.uploadFile({
      bucketName: 'book-covers',
      filePath,
      fileData: imageData,
      metadata: {
        fileName: 'cover.jpg',
        fileSize: imageData.size,
        userId,
        entityType: 'book',
        entityId: bookId,
        mimeType,
        isPublic: true
      }
    });
  }
};

export const PastPaperFileOperations = {
  
  /**
   * Upload a past paper file
   */
  async uploadPastPaper({ pdfPath, paperId, userId, metadata = {} }) {
    const fileName = pdfPath.split('/').pop();
    const filePath = `past-papers/${paperId}/${fileName}`;
    const fileSize = metadata.fileSize || 0;

    return FileOperations.uploadFile({
      bucketName: 'past-papers',
      filePath,
      fileData: metadata.fileData,
      metadata: {
        fileName,
        fileSize,
        userId,
        entityType: 'past_paper',
        entityId: paperId,
        mimeType: 'application/pdf',
        isPublic: false
      }
    });
  }
};

export const AvatarFileOperations = {
  
  /**
   * Upload user avatar
   */
  async uploadAvatar({ userId, imageData, mimeType = 'image/jpeg' }) {
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    const filePath = `avatars/${userId}/profile.${extension}`;

    return FileOperations.uploadFile({
      bucketName: 'user-avatars',
      filePath,
      fileData: imageData,
      metadata: {
        fileName: `profile.${extension}`,
        fileSize: imageData.size,
        userId,
        entityType: 'avatar',
        entityId: userId,
        mimeType,
        isPublic: true
      }
    });
  }
};

export default {
  FileOperations,
  BookFileOperations,
  PastPaperFileOperations,
  AvatarFileOperations
};
