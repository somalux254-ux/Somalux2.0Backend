import { createRequire } from 'module';
import { readFileSync } from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

/**
 * Extract ISBN or Title from PDF
 * Priority:
 * 1. ISBN from filename (e.g., 9780140328721.pdf)
 * 2. ISBN from first 2 pages of PDF
 * 3. Title from first page
 */
export async function extractMetadataFromPDF(pdfPath) {
  const filename = path.basename(pdfPath, '.pdf');
  
  // Strategy 1: Check filename for ISBN (13 or 10 digits)
  const isbnMatch = filename.match(/(\d{13}|\d{10})/);
  if (isbnMatch) {
    console.log(`📖 Found ISBN in filename: ${isbnMatch[1]}`);
    return {
      isbn: isbnMatch[1],
      source: 'filename'
    };
  }

  try {
    // Strategy 2 & 3: Parse PDF content
    const dataBuffer = readFileSync(pdfPath);
    const data = await pdf(dataBuffer, {
      max: 2  // Only read first 2 pages for performance
    });

    const text = data.text || '';
    
    // Look for ISBN in content
    const isbnRegex = /ISBN[:\s-]*(\d{13}|\d{10})/i;
    const contentIsbnMatch = text.match(isbnRegex);
    
    if (contentIsbnMatch) {
      console.log(`📖 Found ISBN in PDF content: ${contentIsbnMatch[1]}`);
      return {
        isbn: contentIsbnMatch[1],
        source: 'content'
      };
    }

    // Strategy 3: Extract title (usually first bold/large text)
    // Look for lines that are likely titles (capitalized, not too long)
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines.slice(0, 10)) {  // Check first 10 lines
      const trimmed = line.trim();
      if (trimmed.length > 3 && trimmed.length < 100 && /^[A-Z]/.test(trimmed)) {
        console.log(`📖 Extracted title from PDF: ${trimmed}`);
        return {
          title: trimmed,
          source: 'content'
        };
      }
    }

    // Fallback: use filename as title
    const cleanTitle = filename.replace(/[-_]/g, ' ').replace(/\d+/g, '').trim();
    console.log(`📖 Using filename as title: ${cleanTitle}`);
    return {
      title: cleanTitle,
      source: 'filename'
    };

  } catch (error) {
    // Handle PDF parsing errors gracefully
    const errorMsg = error.message || '';
    
    // Check for signature verification or encryption errors
    if (errorMsg.includes('signature verification') || 
        errorMsg.includes('encrypted') || 
        errorMsg.includes('password') ||
        errorMsg.includes('Invalid PDF')) {
      console.warn(`⚠️ PDF is encrypted or restricted: ${pdfPath}`);
      console.warn(`   Error: ${errorMsg}`);
      // Return metadata from filename instead of throwing
      const cleanTitle = filename.replace(/[-_]/g, ' ').replace(/\d+/g, '').trim();
      return {
        title: cleanTitle,
        source: 'filename',
        error: 'PDF is encrypted or restricted - metadata extracted from filename only'
      };
    }
    
    console.warn(`⚠️ PDF parsing failed for ${pdfPath}:`, error.message);
    
    // Fallback: use filename as title
    const cleanTitle = filename.replace(/[-_]/g, ' ').replace(/\d+/g, '').trim();
    return {
      title: cleanTitle,
      source: 'filename'
    };
  }
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
