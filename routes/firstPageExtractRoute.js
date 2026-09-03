/**
 * FIRST PAGE HEADER EXTRACTION API ENDPOINT
 * 
 * POST /api/past-papers/extract-first-page
 * 
 * Purpose: Extract metadata from first page of exam papers
 * Focus: Accurate extraction of Unit Code, Unit Name, and Year
 * 
 * Request: multipart/form-data with PDF file
 * Response: {unitCode, unitName, year, semester, examType, confidence, validationScore}
 */

import express from 'express';
import multer from 'multer';
import { extractFirstPageAcademicHeader } from '../utils/firstPageHeaderExtractor.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

/**
 * POST /api/past-papers/extract-first-page
 * 
 * Extract metadata from first page of PDF
 */
router.post('/extract-first-page', upload.single('pdf'), async (req, res) => {
  try {
    const pdf = req.file;
    
    if (!pdf) {
      return res.status(400).json({ success: false, error: 'No PDF file' });
    }
    
    console.log(`\n📖 [EXTRACT] Processing: ${pdf.originalname}`);
    
    // Extract from first page
    const result = await extractFirstPageAcademicHeader(pdf.buffer);
    
    console.log(`✅ [EXTRACT] Result:`, result);
    
    // Return ONLY the 3 required fields
    res.json({
      success: result.unitCode && result.unitName && result.year ? true : false,
      unitCode: result.unitCode || null,
      unitName: result.unitName || null,
      year: result.year || null
    });
    
  } catch (error) {
    console.error('❌ [EXTRACT] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/past-papers/extract-first-page-batch
 * 
 * Extract metadata from multiple PDFs (batch processing)
 * Useful for bulk uploads
 */
router.post('/extract-first-page-batch', upload.array('pdfs', 20), async (req, res) => {
  try {
    const pdfs = req.files;
    
    if (!pdfs || pdfs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No PDF files provided'
      });
    }
    
    console.log(`\n📦 [BATCH-EXTRACT] Processing ${pdfs.length} files...`);
    
    const results = [];
    
    for (const pdf of pdfs) {
      try {
        const extraction = await extractFirstPageAcademicHeader(pdf.buffer);
        const validation = validateExtractionResults(extraction.extraction);
        
        results.push({
          fileName: pdf.originalname,
          success: extraction.success,
          extraction: {
            unitCode: extraction.extraction.unitCode || null,
            unitName: extraction.extraction.unitName || null,
            year: extraction.extraction.year || null,
            semester: extraction.extraction.semester || null,
            examType: extraction.extraction.examType || 'Main'
          },
          confidence: extraction.extraction.confidence || {},
          validation: {
            quality: validation.quality,
            score: parseFloat(validation.score.toFixed(3)),
            isValid: validation.isValid
          },
          error: extraction.error
        });
      } catch (fileError) {
        results.push({
          fileName: pdf.originalname,
          success: false,
          error: fileError.message
        });
      }
    }
    
    console.log(`✅ [BATCH-EXTRACT] Completed - Processed ${pdfs.length} files`);
    
    res.json({
      success: true,
      totalFiles: pdfs.length,
      results: results,
      summary: {
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        qualityBreakdown: {
          excellent: results.filter(r => r.validation?.quality === 'excellent').length,
          good: results.filter(r => r.validation?.quality === 'good').length,
          fair: results.filter(r => r.validation?.quality === 'fair').length,
          poor: results.filter(r => r.validation?.quality === 'poor').length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [BATCH-EXTRACT] Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Batch extraction failed'
    });
  }
});

export default router;
