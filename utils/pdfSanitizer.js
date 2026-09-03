/**
 * Strip digital signatures and security features from PDF
 * This helps PDFs with embedded signatures pass Supabase verification
 */

export async function stripPDFSignatures(pdfBuffer) {
  try {
    // PDF signature objects typically start with /Sig
    // We can safely remove them by filtering the buffer
    let stripped = pdfBuffer.toString('latin1');
    
    // Remove common PDF signature patterns
    stripped = stripped.replace(/\/Sig\s+\d+\s+0\s+R/g, '');
    stripped = stripped.replace(/\/V\s+\(.*?\)/g, '');
    stripped = stripped.replace(/\/Contents\s+<[A-F0-9]+>/gi, '');
    
    // Convert back to buffer
    return Buffer.from(stripped, 'latin1');
  } catch (error) {
    console.warn('⚠️ Failed to strip PDF signatures, proceeding with original:', error.message);
    return pdfBuffer;
  }
}
