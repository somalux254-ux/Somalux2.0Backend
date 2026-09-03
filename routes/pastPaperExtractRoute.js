import express from 'express';
import multer from 'multer';
import { extractPastPaperDetailsFromScannedPDF } from '../utils/ocrExtractPDF.js';

const router = express.Router();

// Multer configuration for temporary file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
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
 * POST /api/past-papers/extract
 * Extract metadata from a scanned past paper PDF
 * 
 * Request:
 * - Body: form-data with 'pdf' field containing PDF file
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     unit_code: string,
 *     unit_name: string,
 *     faculty: string|null,
 *     year: number|null,
 *     semester: string|null,
 *     exam_type: string,
 *     confidence: object
 *   },
 *   message: string
 * }
 */
router.post('/extract', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file provided'
      });
    }

    console.log(`\n📄 [EXTRACT-API] Processing PDF: ${req.file.originalname}`);
    console.log(`📦 [EXTRACT-API] File size: ${req.file.size} bytes`);

    // Extract using the advanced OCR + direct extraction logic
    const extractedDetails = await extractPastPaperDetailsFromScannedPDF(
      req.file.buffer,
      req.file.originalname
    );

    console.log(`✅ [EXTRACT-API] Extraction complete:`, {
      unit_code: extractedDetails.unit_code,
      unit_name: extractedDetails.unit_name,
      year: extractedDetails.year,
      confidence: extractedDetails.confidence
    });

    return res.status(200).json({
      success: true,
      data: {
        unit_code: extractedDetails.unit_code,
        unit_name: extractedDetails.unit_name,
        faculty: extractedDetails.faculty,
        year: extractedDetails.year,
        semester: extractedDetails.semester,
        exam_type: extractedDetails.exam_type,
        confidence: extractedDetails.confidence
      },
      message: 'PDF extraction successful'
    });
  } catch (error) {
    console.error(`❌ [EXTRACT-API] Extraction failed:`, error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to extract PDF metadata',
      error: error.message
    });
  }
});

export default router;
