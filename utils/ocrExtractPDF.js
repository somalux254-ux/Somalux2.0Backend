import 'dotenv/config';
import Tesseract from 'tesseract.js';
import { createCanvas } from 'canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Extract text directly from PDF using PDF.js (works with searchable PDFs)
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {number} pageNum - Page number to extract (1-indexed)
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextFromPDFPageDirect(pdfBuffer, pageNum = 1) {
  try {
    console.log(`📖 [PDF.js] Extracting text from page ${pageNum}...`);
    
    // Load PDF document
    const pdfDoc = await pdfjs.getDocument({ data: pdfBuffer }).promise;
    
    if (pageNum > pdfDoc.numPages) {
      console.warn(`⚠️ [PDF.js] Page ${pageNum} exceeds document pages (${pdfDoc.numPages})`);
      return '';
    }
    
    // Get the page
    const page = await pdfDoc.getPage(pageNum);
    
    // Extract text content from page
    const textContent = await page.getTextContent();
    
    // Combine text items into a single string
    const text = textContent.items
      .map(item => item.str)
      .join(' ');
    
    console.log(`✅ [PDF.js] Extracted ${text.length} characters from page ${pageNum}`);
    return text;
  } catch (error) {
    console.error(`❌ [PDF.js] Failed to extract page ${pageNum}:`, error.message);
    return '';
  }
}

/**
 * Extract text from a single PDF page using OCR (for scanned documents)
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {number} pageNum - Page number to extract (1-indexed)
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextFromPDFPage(pdfBuffer, pageNum = 1) {
  try {
    console.log(`🔍 [OCR] Extracting text from page ${pageNum}...`);
    
    // Load PDF document
    const pdfDoc = await pdfjs.getDocument({ data: pdfBuffer }).promise;
    
    if (pageNum > pdfDoc.numPages) {
      console.warn(`⚠️ [OCR] Page ${pageNum} exceeds document pages (${pdfDoc.numPages})`);
      return '';
    }
    
    // Get the page
    const page = await pdfDoc.getPage(pageNum);
    
    // Set rendering scale
    const scale = 2;
    const viewport = page.getViewport({ scale });
    
    // Create canvas for rendering
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    // Render PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Convert canvas to image buffer
    const imageBuffer = canvas.toBuffer('image/png');
    
    // Run OCR on the image
    console.log(`🧠 [OCR] Running Tesseract OCR on page ${pageNum}...`);
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing') {
          console.log(`   OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    console.log(`✅ [OCR] Extracted ${text.length} characters from page ${pageNum}`);
    return text;
  } catch (error) {
    console.error(`❌ [OCR] Failed to extract page ${pageNum}:`, error.message);
    throw error;
  }
}

/**
 * Extract structured past paper details from PDF text
 * FOCUS: Unit Name, Unit Code, Year, Semester (no Faculty)
 * @param {string} text - Raw text from PDF
 * @returns {object} Extracted details
 */
export function parsePastPaperDetails(text) {
  const details = {
    unit_code: null,
    unit_name: null,
    faculty: null,  // Not extracted
    year: null,
    semester: null,
    exam_type: 'Main',
    confidence: {}
  };

  if (!text || text.trim().length === 0) {
    console.warn('⚠️ [PARSE] No text provided for parsing');
    return details;
  }

  // Split into lines for processing
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = text.toUpperCase();

  console.log(`📄 [PARSE] Processing ${lines.length} lines, ${text.length} total chars`);
  console.log(`📝 [PARSE] First 10 lines:\n${lines.slice(0, 10).map((l, i) => `  [${i}] "${l}"`).join('\n')}`);
  

  // ========== YEAR EXTRACTION ==========
  // Look for years in various contexts: "2021", "2022", etc.
  console.log(`\n🔎 [YEAR] Searching for examination year...`);
  
  // Try date context first (e.g., "26th March, 2012")
  let dateContextYear = null;
  const dateMatch = text.match(/\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+(20\d{2}|19\d{2})/i);
  if (dateMatch) {
    dateContextYear = parseInt(dateMatch[1]);
  }

  if (dateContextYear && dateContextYear >= 1990 && dateContextYear <= new Date().getFullYear() + 1) {
    details.year = dateContextYear;
    details.confidence.year = 0.95;
    console.log(`✅ [YEAR] Extracted from date context: ${details.year}`);
  } else {
    // Fallback: extract all years and pick the most reasonable one
    const yearMatches = text.match(/(20\d{2}|19\d{2})/g);
    if (yearMatches) {
      const uniqueYears = [...new Set(yearMatches.map(y => parseInt(y)))].filter(y => y >= 1990 && y <= new Date().getFullYear() + 1);
      if (uniqueYears.length > 0) {
        // If multiple years, pick the one closest to current date
        const now = new Date().getFullYear();
        uniqueYears.sort((a, b) => Math.abs(b - now) - Math.abs(a - now));
        details.year = uniqueYears[0];
        details.confidence.year = 0.9;
        console.log(`✅ [YEAR] Extracted from text: ${details.year}`);
      }
    }
  }

  if (!details.year) {
    console.log(`⚠️ [YEAR] No year pattern matched`);
  }

  // ========== SEMESTER EXTRACTION ==========
  // Look for semester indicators: "1", "2", "3", "I", "II", "III", etc.
  console.log(`\n🔎 [SEMESTER] Searching for semester...`);
  
  const semesterPatterns = [
    // Pattern 1: "Semester" or "SEM" followed by number
    { regex: /(?:SEMESTER|SEM)\s*[:\-]?\s*([1-3])/i, value: null, priority: 100 },
    
    // Pattern 2: Roman numerals (I, II, III)
    { regex: /\b(?:SEMESTER|SEM)\s*[:\-]?\s*(I{1,3})\b/i, value: null, priority: 95 },
    
    // Pattern 3: First, Second, Third
    { regex: /\b(FIRST|SECOND|THIRD)\s+SEMESTER\b/i, value: null, priority: 90 },
    
    // Pattern 4: Standalone semester number
    { regex: /^SEMESTER\s*[:\-]?\s*([1-3])$/im, value: null, priority: 85 },
  ];

  for (const { regex, priority } of semesterPatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      let semValue = match[1].toUpperCase();
      
      // Convert Roman numerals to numbers
      if (semValue === 'I') semValue = '1';
      else if (semValue === 'II') semValue = '2';
      else if (semValue === 'III') semValue = '3';
      else if (semValue === 'FIRST') semValue = '1';
      else if (semValue === 'SECOND') semValue = '2';
      else if (semValue === 'THIRD') semValue = '3';
      
      // Validate it's 1-3
      if (/^[1-3]$/.test(semValue)) {
        details.semester = semValue;
        details.confidence.semester = 0.85 + (priority / 1000);
        console.log(`✅ [SEMESTER] Extracted: ${semValue} (priority: ${priority})`);
        break;
      }
    }
  }

  if (!details.semester) {
    console.log(`⚠️ [SEMESTER] No semester pattern matched`);
  }

  // ========== EXAM TYPE EXTRACTION ==========
  const examTypePatterns = [
    { pattern: /SUPPLEMENTARY|SUPP|RE[\-\s]?EXAM|MAKEUP|RETAKE/i, value: 'Supplementary' },
    { pattern: /\bCAT\b|CONTINUOUS\s+ASSESSMENT|CAT\s+\d|CONTINUOUS.*TEST/i, value: 'CAT' },
    { pattern: /MOCK|PRACTICE|SAMPLE|TRIAL|DUMMY/i, value: 'Mock' },
    { pattern: /MAIN|FINAL|END[\s\-]?OF[\s\-]?SEMESTER|MAJOR\s+EXAM|ORDINARY/i, value: 'Main' }
  ];

  for (const { pattern, value } of examTypePatterns) {
    if (pattern.test(text)) {
      details.exam_type = value;
      details.confidence.exam_type = 0.9;
      break;
    }
  }

  // ========== UNIT CODE EXTRACTION ==========
  // Extract NUMBER (Unit Code: e.g., "116", "101") from patterns like "SCE 116", "KAS-101"
  console.log(`\n🔎 [UNIT-CODE] Searching for unit code patterns...`);
  
  const codePatterns = [
    // Pattern 1: "LETTERS SPACE NUMBERS" (e.g., "SCE 116", "KAS 101")
    { regex: /\b[A-Z]{2,4}\s+(\d{2,4})\b/, priority: 100 },
    
    // Pattern 2: "LETTERS-NUMBERS" (e.g., "HSU-100", "SCE-116")
    { regex: /\b[A-Z]{2,4}\s*[\-–]\s*(\d{2,4})\b/, priority: 95 },
    
    // Pattern 3: "LETTERSNUMBERS" (no space, e.g., "HSU100", "SCE116")
    { regex: /\b[A-Z]{2,4}(\d{2,4})\b/, priority: 90 },
    
    // Pattern 4: "WORD SPACE NUMBERS" (e.g., "BIOLOGY 301", "PHYSICS 101")
    { regex: /\b[A-Za-z]+\s+(\d{2,4})\b/, priority: 85 },
  ];

  for (const { regex, priority } of codePatterns) {
    const match = text.match(regex);
    if (match) {
      const number = match[1];
      
      // Validate number is ONLY digits (2-4 digits)
      if (/^\d{2,4}$/.test(number)) {
        details.unit_code = number;   // NUMBER is the Unit Code
        details.confidence.unit_code = 0.9 + (priority / 1000);
        console.log(`✅ [UNIT-CODE] Extracted: Unit Code="${number}" (priority: ${priority})`);
        break;
      } else {
        console.log(`❌ [UNIT-CODE] Rejected - code number invalid: "${number}"`);
      }
    }
  }

  if (!details.unit_code) {
    console.log(`⚠️ [UNIT-CODE] No unit code pattern matched`);
  }

  // ========== UNIT NAME EXTRACTION ==========
  // Extract actual descriptive name from the PDF (NOT just the prefix)
  // Strategy: Find title-like text near the unit code or as standalone line
  console.log(`\n🔎 [UNIT-NAME] Searching for descriptive unit name...`);
  
  let unitNameFound = false;
  
  // Strategy 1: Look for capitalized text after unit code pattern
  // E.g., "CHEM 201: GENERAL CHEMISTRY" or "CHEM 201 - General Chemistry"
  const unitCodeContext = /\b[A-Z]{2,4}\s*[\-:]?\s*\d{2,4}\s*[\-:]?\s*([A-Z][A-Za-z\s&]+?)(?:\n|$|\d{4}|EXAM|TEST|PAPER)/i;
  const codeContextMatch = text.match(unitCodeContext);
  if (codeContextMatch && codeContextMatch[1]) {
    let candidateName = codeContextMatch[1].trim();
    
    // Clean up and validate
    if (candidateName.length > 5 && candidateName.length < 100) {
      // Reject if contains digits (per requirements)
      if (!/\d/.test(candidateName)) {
        details.unit_name = candidateName;
        details.confidence.unit_name = 0.95;
        console.log(`✅ [UNIT-NAME] Extracted from context: "${details.unit_name}"`);
        unitNameFound = true;
      }
    }
  }
  
  // Strategy 2: Look for title-like capitalized lines (mostly uppercase or Title Case)
  if (!unitNameFound) {
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i];
      
      // Skip short lines or lines with numbers
      if (line.length < 5 || line.length > 100 || /\d/.test(line)) {
        continue;
      }
      
      // Check if line looks like a title (has uppercase words)
      const wordCount = line.split(/\s+/).length;
      const uppercaseWords = (line.match(/[A-Z][a-z]+/g) || []).length;
      
      if (wordCount >= 2 && uppercaseWords >= 1 && line.match(/[A-Z]/)) {
        details.unit_name = line;
        details.confidence.unit_name = 0.8;
        console.log(`✅ [UNIT-NAME] Extracted from title-like line: "${details.unit_name}"`);
        unitNameFound = true;
        break;
      }
    }
  }
  
  if (!unitNameFound) {
    console.log(`⚠️ [UNIT-NAME] No descriptive unit name found in PDF`);
  }

  return details;
}

/**
 * Main function to extract past paper details from PDF (tries direct text extraction first, then OCR)
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} fileName - Original filename for fallback
 * @returns {Promise<object>} Extracted details
 */
export async function extractPastPaperDetailsFromScannedPDF(pdfBuffer, fileName = '') {
  try {
    console.log(`\n📄 [PAST-PAPER-EXTRACT] Processing: ${fileName || 'unknown'}`);
    
    // Load PDF to check page count
    const pdfDoc = await pdfjs.getDocument({ data: pdfBuffer }).promise;
    const pageCount = pdfDoc.numPages;
    console.log(`📖 [PAST-PAPER-EXTRACT] PDF has ${pageCount} pages`);

    // ========== STRATEGY 1: Try direct text extraction (for searchable PDFs) ==========
    console.log(`🔄 [PAST-PAPER-EXTRACT] Attempting direct PDF text extraction...`);
    let extractedText = '';
    
    // Try to extract from first 3 pages
    for (let page = 1; page <= Math.min(3, pageCount); page++) {
      try {
        const pageText = await extractTextFromPDFPageDirect(pdfBuffer, page);
        if (pageText && pageText.trim().length > 0) {
          extractedText += ' ' + pageText; // Accumulate text from multiple pages
          console.log(`✅ [PAST-PAPER-EXTRACT] Extracted ${pageText.length} chars from page ${page}`);
          // Continue to get more text from more pages if available
          if (extractedText.length > 300) break; // Stop if we have sufficient text
        }
      } catch (err) {
        console.warn(`⚠️ [PAST-PAPER-EXTRACT] Could not extract from page ${page}: ${err.message}`);
      }
    }

    // Check if extracted text is sufficient
    console.log(`📊 [PAST-PAPER-EXTRACT] Direct extraction result: ${extractedText.trim().length} characters`);
    
    // ========== STRATEGY 2: Fall back to OCR if direct extraction is insufficient ==========
    // OCR is needed if:
    // 1. No text extracted (likely scanned PDF with images)
    // 2. Very little text (< 50 chars means extraction probably failed)
    if (!extractedText || extractedText.trim().length < 50) {
      console.log(`⚠️ [PAST-PAPER-EXTRACT] Direct extraction insufficient (${extractedText.trim().length} chars), triggering OCR...`);
      
      // Try OCR on first page
      try {
        console.log(`🧠 [PAST-PAPER-EXTRACT] Running OCR on page 1 (scanned PDF conversion)...`);
        extractedText = await extractTextFromPDFPage(pdfBuffer, 1);
        
        if (extractedText && extractedText.trim().length > 0) {
          console.log(`✅ [PAST-PAPER-EXTRACT] OCR successful: Extracted ${extractedText.length} chars from page 1`);
        } else {
          console.warn(`⚠️ [PAST-PAPER-EXTRACT] OCR returned empty text from page 1`);
          
          // Try second page if first page yielded nothing
          if (pageCount > 1) {
            try {
              console.log(`🧠 [PAST-PAPER-EXTRACT] Trying OCR on page 2...`);
              const page2Text = await extractTextFromPDFPage(pdfBuffer, 2);
              if (page2Text && page2Text.trim().length > 0) {
                extractedText = page2Text;
                console.log(`✅ [PAST-PAPER-EXTRACT] OCR successful on page 2: ${extractedText.length} chars`);
              }
            } catch (err) {
              console.warn(`⚠️ [PAST-PAPER-EXTRACT] OCR failed on page 2: ${err.message}`);
            }
          }
        }
      } catch (err) {
        console.error(`❌ [PAST-PAPER-EXTRACT] OCR failed on page 1: ${err.message}`);
        // Continue with whatever text we have
      }
    } else {
      console.log(`✅ [PAST-PAPER-EXTRACT] Direct extraction successful with ${extractedText.trim().length} characters - OCR not needed`);
    }

    // ========== PARSE EXTRACTED TEXT ==========
    const details = parsePastPaperDetails(extractedText);

    // ========== FALLBACK: Extract from filename ONLY for unit_code if missing ==========
    // CRITICAL: DO NEVER use filename for unit_name - only extract from PDF content
    if ((!details.unit_code) && fileName) {
      console.log(`📝 [PAST-PAPER-EXTRACT] Attempting filename parsing for missing unit_code...`);
      const fileNameDetails = parseFileNameForPastPaper(fileName);
      
      // ONLY merge unit_code from filename, NEVER unit_name or other metadata
      if (fileNameDetails.unit_code && !details.unit_code) {
        // Validate unit_code: must be ONLY digits
        if (/^\d{2,4}$/.test(fileNameDetails.unit_code)) {
          details.unit_code = fileNameDetails.unit_code;
          if (!details.confidence.unit_code) {
            details.confidence.unit_code = 0.6; // Lower confidence for filename parsing
          }
          console.log(`📝 [PAST-PAPER-EXTRACT] Extracted unit_code from filename: ${details.unit_code}`);
        }
      }
      
      // Only extract year from filename if PDF extraction failed
      if (!details.year && fileNameDetails.year) {
        details.year = fileNameDetails.year;
        if (!details.confidence.year) {
          details.confidence.year = 0.5; // Lower confidence
        }
      }
      
      // ⚠️ ABSOLUTE CRITICAL: NEVER use unit_name from filename under ANY circumstances
      // Even if fileNameDetails.unit_name is provided, it MUST be ignored
      if (fileNameDetails.unit_name) {
        console.error(`❌ [CRITICAL] Attempted to use unit_name from filename! This is FORBIDDEN.`);
        console.error(`❌ unit_name MUST come from PDF content ONLY`);
        // Explicitly reject any filename-derived unit_name
        fileNameDetails.unit_name = null;
      }
      
      // Explicitly ensure details.unit_name is only from PDF
      if (!details.unit_name) {
        console.warn(`⚠️ [PAST-PAPER-EXTRACT] Unit name NOT found in PDF - leaving empty (will NOT use filename)`);
      }
    }

    console.log(`✅ [PAST-PAPER-EXTRACT] Extraction complete:`, {
      unit_code: details.unit_code,
      unit_name: details.unit_name,
      unit_name_length: details.unit_name ? details.unit_name.length : 0,
      unit_name_from: details.unit_name ? 'PDF_CONTENT' : 'NOT_FOUND',
      faculty: details.faculty,
      year: details.year,
      semester: details.semester,
      exam_type: details.exam_type,
      confidence: details.confidence
    });
    
    return details;

  } catch (error) {
    console.error(`❌ [PAST-PAPER-EXTRACT] Failed to extract details:`, error.message);
    // Return empty details with error flag
    return {
      unit_code: null,
      unit_name: null,
      faculty: null,
      year: null,
      semester: null,
      exam_type: 'Main',
      error: error.message,
      confidence: {}
    };
  }
}

/**
 * Parse filename for past paper details (fallback method)
 * IMPORTANT: NEVER extract unitName from filename
 * IMPORTANT: unitCode must be ONLY digits, no letters
 * Expected formats:
 *   - "UCU101-2018-06-18.pdf"
 *   - "APL808_2019.pdf"
 *   - "EAE301-Introduction-2021.pdf"
 */
export function parseFileNameForPastPaper(fileName) {
  const details = {
    unit_code: null,
    unit_name: null,  // ⚠️ ALWAYS REMAINS NULL - NEVER extracted from filename
    faculty: null,
    year: null,
    semester: null,
    exam_type: 'Main'
  };

  // Remove extension
  const baseName = fileName.replace(/\.[^/.]+$/, '').toUpperCase();

  // Extract NUMBER ONLY from the CODE pattern (e.g., "101" from "UCU101")
  // Patterns: "UCU 101", "UCU101", "UCU-101", "HPH70020120402"
  // ⚠️ CRITICAL: NEVER extract PREFIX as unit_name from filename
  // ⚠️ CRITICAL: unit_name MUST come from PDF content only - NEVER FROM FILENAME
  
  // Strategy: Extract PREFIX, then find the first significant digit group (2-4 digits not part of date)
  const prefixMatch = baseName.match(/^([A-Z]{2,6})/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const afterPrefix = baseName.substring(prefix.length);
    
    // Try different patterns to find unit code
    let unitCode = null;
    
    // Pattern 1: Digits immediately after prefix "APH1012"
    let digitsMatch = afterPrefix.match(/^(\d{2,4})/);
    if (digitsMatch && !/^\d{8}$/.test(digitsMatch[1])) {
      unitCode = digitsMatch[1];
    } else {
      // Pattern 2: Extract 2-4 digits that are NOT part of an 8-digit date (yyyymmdd)
      // Look for digit sequences surrounded by non-digits or separators
      const allDigits = afterPrefix.match(/(\d{1,4})/g);
      if (allDigits && allDigits.length > 0) {
        // Skip 8-digit sequences (these are dates like 20120402)
        // Take the first 2-4 digit sequence that's not 8 digits
        for (const digits of allDigits) {
          if (digits.length >= 2 && digits.length <= 4) {
            unitCode = digits;
            break;
          }
        }
      }
    }
    
    // Validate: unit_code must be ONLY digits (no letters, no special chars)
    if (unitCode && /^\d{2,4}$/.test(unitCode)) {
      details.unit_code = unitCode; // NUMBER ONLY (e.g., "101")
      console.log(`✅ [FILENAME-PARSE] Extracted unit_code (digits only): "${unitCode}" from prefix: "${prefix}"`);
    } else {
      console.log(`❌ [FILENAME-PARSE] Could not extract valid unit_code from filename: "${baseName}"`);
    }
    // ⚠️ NOTE: unit_name is NEVER set from filename - not even from the prefix
  }

  // Try to extract year (looking for 4-digit year patterns)
  const yearMatch = baseName.match(/(?:20|19)\d{2}/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0]);
    if (year >= 1990 && year <= new Date().getFullYear() + 1) {
      details.year = year;
    }
  }

  // Try to extract semester
  const semesterMatch = baseName.match(/[_\-\s]([1-3])(?:[_\-\s]|$)/);
  if (semesterMatch) {
    details.semester = semesterMatch[1];
  }

  // Try to extract exam type
  if (/supplementary|supp/i.test(baseName)) details.exam_type = 'Supplementary';
  else if (/\bcat\b/i.test(baseName)) details.exam_type = 'CAT';
  else if (/mock/i.test(baseName)) details.exam_type = 'Mock';

  // ⚠️ CRITICAL LOG: Explicitly state that unitName is NEVER extracted from filename
  console.warn(`⚠️ [FILENAME-PARSE] ✅ Confirmed: unit_name is NEVER extracted from filename`);
  console.warn(`⚠️ [FILENAME-PARSE] ✅ unit_name field remains NULL - must come from PDF content only`);

  return details;
}
