/**
 * FIRST PAGE EXTRACTION - ULTRA SIMPLE
 * Extract ONLY: unitName (letters), unitCode (number), year
 */

import * as pdfParseModule from 'pdf-parse';
const pdfParse = pdfParseModule.default || pdfParseModule;

/**
 * Extract unit name, code, and year from PDF first page
 * Returns: { unitCode, unitName, year }
 */
export async function extractFirstPageAcademicHeader(pdfBuffer) {
  try {
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text || '';

    if (!text || text.length < 50) {
      return { unitCode: null, unitName: null, year: null };
    }

    let unitName = null;
    let unitCode = null;
    let year = null;

    // Extract Unit Name (letters) + Unit Code (number)
    // Example: "APS 412" → unitName="APS", unitCode="412"
    const codeMatch = text.match(/\b([A-Z]{2,5})\s+(\d{3,4})\b/);
    if (codeMatch) {
      unitName = codeMatch[1];
      unitCode = codeMatch[2];
      console.log(`✅ Found: ${unitName} ${unitCode}`);
    }

    // Extract Year
    // Example: "2020/2021" → year=2021 (take second year if present)
    const yearMatch = text.match(/20\d{2}(?:[\/\-](20\d{2}))?/);
    if (yearMatch) {
      const yearStr = yearMatch[0];
      if (yearStr.includes('/') || yearStr.includes('-')) {
        year = parseInt(yearStr.split(/[\/\-]/)[1]);
      } else {
        year = parseInt(yearStr);
      }
      console.log(`✅ Year: ${year}`);
    }

    return { unitCode, unitName, year };

  } catch (error) {
    console.error('❌ Extraction error:', error.message);
    return { unitCode: null, unitName: null, year: null };
  }
}

export default { extractFirstPageAcademicHeader };
