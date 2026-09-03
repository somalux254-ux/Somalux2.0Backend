import axios from 'axios';
import { load as cheerioLoad } from 'cheerio';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { extractPastPaperDetailsFromScannedPDF } from '../utils/ocrExtractPDF.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DSPACE_BASE_URL = 'https://pastpapers.ku.ac.ke';
const DOWNLOAD_DIR = path.join(__dirname, '../../storage/pastpapers');

/**
 * PastPapersDownloaderService
 * Handles scraping and downloading papers from Kenyatta University DSpace
 */
class PastPapersDownloaderService {
  constructor() {
    this.activeDownloads = new Map();
    this.ensureDownloadDir();
  }

  ensureDownloadDir() {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }
  }

  /**
   * Get all communities/schools from DSpace
   */
  async getSchools() {
    try {
      const response = await axios.get(`${DSPACE_BASE_URL}/`, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      const $ = cheerioLoad(response.data);
      const schools = [];

      // Extract community links
      $('a[href*="/handle/123456789/"]').each((_, elem) => {
        const $elem = $(elem);
        const text = $elem.text().trim();
        const href = $elem.attr('href');
        const count = $elem.parent().text().match(/\[(\d+)\]/)?.[1] || '0';

        if (text.includes('School') || text.includes('Common Units')) {
          schools.push({
            id: href.split('/').pop(),
            name: text,
            url: href,
            paperCount: parseInt(count),
            type: 'community'
          });
        }
      });

      return schools;
    } catch (error) {
      throw new Error(`Failed to fetch schools: ${error.message}`);
    }
  }

  /**
   * Get papers from a specific school/community
   */
  async getSchoolPapers(schoolHandle, page = 1) {
    try {
      const itemsPerPage = 20;
      const start = (page - 1) * itemsPerPage;
      
      const url = `${DSPACE_BASE_URL}/handle/${schoolHandle}?offset=${start}`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const $ = cheerioLoad(response.data);
      const papers = [];

      $('div.artifact').each((_, elem) => {
        const $elem = $(elem);
        const titleElem = $elem.find('a[href*="/handle/123456789/"]').first();
        const title = titleElem.text().trim();
        const url = titleElem.attr('href');
        const code = $elem.find('.metadata-fields').text().match(/\(([^)]+)\)/)?.[1] || '';

        if (title && url) {
          papers.push({
            id: url.split('/').pop(),
            title,
            code,
            url,
            school: schoolHandle,
            hasDownload: false
          });
        }
      });

      // Check for next page
      const hasNextPage = $('a[rel="next"]').length > 0;

      return {
        papers,
        hasNextPage,
        page,
        totalOnPage: papers.length
      };
    } catch (error) {
      throw new Error(`Failed to fetch papers from school: ${error.message}`);
    }
  }

  /**
   * Get download URL and metadata for a specific paper
   */
  async getPaperDetails(paperId) {
    try {
      const url = `${DSPACE_BASE_URL}/handle/123456789/${paperId}`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const $ = cheerioLoad(response.data);
      
      // Extract metadata
      const title = $('h1.media-heading, h1.page-title').text().trim();
      const date = $('span[property="dateIssued"]').text().trim();
      
      // Extract download links
      const downloadLinks = [];
      $('a[href*="/bitstream/"]').each((_, elem) => {
        const $elem = $(elem);
        const href = $elem.attr('href');
        const filename = href?.split('/').pop() || '';
        
        if (filename.match(/\.(pdf|doc|docx)$/i)) {
          downloadLinks.push({
            url: `${DSPACE_BASE_URL}${href}`,
            filename,
            type: filename.split('.').pop().toUpperCase()
          });
        }
      });

      return {
        paperId,
        title,
        date,
        url,
        downloadLinks,
        available: downloadLinks.length > 0
      };
    } catch (error) {
      throw new Error(`Failed to fetch paper details: ${error.message}`);
    }
  }

  /**
   * Start a bulk download process
   */
  async startBulkDownload(config) {
    const processId = uuidv4();
    const process = {
      id: processId,
      schoolId: config.schoolId,
      schoolName: config.schoolName,
      status: 'running',
      startTime: new Date(),
      stats: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0
      },
      papers: [],
      errors: [],
      userId: config.userId,
      downloadDir: path.join(DOWNLOAD_DIR, processId)
    };

    // Create download directory
    fs.mkdirSync(process.downloadDir, { recursive: true });

    // Store process
    this.activeDownloads.set(processId, process);

    // Start async download
    this._executeBulkDownload(process, config);

    return process;
  }

  /**
   * Internal method to execute bulk download
   */
  async _executeBulkDownload(process, config) {
    try {
      let page = 1;
      let hasMore = true;

      while (hasMore && process.status === 'running') {
        const result = await this.getSchoolPapers(config.schoolId, page);
        
        for (const paper of result.papers) {
          if (process.status !== 'running') break;

          process.stats.total++;
          
          try {
            const details = await this.getPaperDetails(paper.id);

            if (!details.available) {
              process.stats.skipped++;
              continue;
            }

            // Download first available file
            const downloadLink = details.downloadLinks[0];
            const downloaded = await this._downloadFile(
              downloadLink.url,
              downloadLink.filename,
              process.downloadDir
            );

            if (downloaded) {
              process.stats.successful++;
              paper.downloaded = true;
              paper.filename = downloadLink.filename;
              paper.title = details.title;
              paper.date = details.date;
            } else {
              process.stats.failed++;
              process.errors.push(`Failed to download: ${paper.title}`);
            }
          } catch (error) {
            process.stats.failed++;
            process.errors.push(`Error processing ${paper.title}: ${error.message}`);
          }

          process.stats.processed++;
          process.papers.push(paper);
          
          // Respect server - add delay between downloads
          await this._delay(500);
        }

        hasMore = result.hasNextPage;
        page++;
      }

      process.status = process.status === 'running' ? 'completed' : process.status;
      process.endTime = new Date();
    } catch (error) {
      process.status = 'failed';
      process.error = error.message;
      process.endTime = new Date();
    }
  }

  /**
   * Download a single file and rename based on extracted metadata
   */
  async _downloadFile(url, filename, destDir) {
    try {
      // Create a temporary filename for initial download
      const tempFilename = `temp_${Date.now()}_${filename}`;
      const tempFilepath = path.join(destDir, tempFilename);
      
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      return new Promise(async (resolve, reject) => {
        const stream = fs.createWriteStream(tempFilepath);
        response.data.pipe(stream);
        
        stream.on('finish', async () => {
          try {
            // Extract metadata from downloaded PDF
            const fileBuffer = fs.readFileSync(tempFilepath);
            console.log(`🔍 Extracting metadata from: ${filename}`);
            const metadata = await extractPastPaperDetailsFromScannedPDF(fileBuffer, filename);
            
            console.log(`📊 Extracted metadata:`, metadata);
            
            // Determine final filename based on extracted metadata
            let finalFilename = filename; // Default to original
            
            if (metadata && metadata.unit_name && metadata.unit_code) {
              const ext = path.extname(filename);
              // Format: UNITNAME-CODE-YEAR.pdf (e.g., UCU-101-2018.pdf)
              finalFilename = `${metadata.unit_name}-${metadata.unit_code}-${metadata.year || 'unknown'}${ext}`;
              console.log(`✅ Generated new filename: ${finalFilename}`);
            } else {
              console.warn(`⚠️  Incomplete metadata - using original filename. Got:`, {
                unit_name: metadata?.unit_name,
                unit_code: metadata?.unit_code,
                year: metadata?.year
              });
            }
            
            const finalFilepath = path.join(destDir, finalFilename);
            
            // Rename the temp file to final name
            fs.renameSync(tempFilepath, finalFilepath);
            
            if (finalFilename !== filename) {
              console.log(`📝 File renamed: ${filename} → ${finalFilename}`);
            }
            
            resolve(true);
          } catch (err) {
            // If metadata extraction fails, just use original filename
            console.warn(`❌ Metadata extraction failed, keeping original filename:`, err.message);
            console.error(`Full error:`, err);
            try {
              const finalFilepath = path.join(destDir, filename);
              fs.renameSync(tempFilepath, finalFilepath);
            } catch (renameErr) {
              console.error(`Failed to rename temp file: ${renameErr.message}`);
            }
            resolve(true);
          }
        });
        
        stream.on('error', (err) => {
          try {
            fs.unlinkSync(tempFilepath);
          } catch (e) {}
          reject(err);
        });
      });
    } catch (error) {
      console.error(`Download failed for ${filename}:`, error.message);
      return false;
    }
  }

  /**
   * Pause a download process
   */
  pauseDownload(processId) {
    const process = this.activeDownloads.get(processId);
    if (process && process.status === 'running') {
      process.status = 'paused';
      return true;
    }
    return false;
  }

  /**
   * Resume a paused download
   */
  resumeDownload(processId) {
    const process = this.activeDownloads.get(processId);
    if (process && process.status === 'paused') {
      process.status = 'running';
      // Continue from where it left off
      return true;
    }
    return false;
  }

  /**
   * Stop a download process
   */
  stopDownload(processId) {
    const process = this.activeDownloads.get(processId);
    if (process) {
      process.status = 'stopped';
      return true;
    }
    return false;
  }

  /**
   * Get process status
   */
  getProcessStatus(processId) {
    return this.activeDownloads.get(processId) || null;
  }

  /**
   * Get all active processes
   */
  getAllProcesses(userId = null) {
    const processes = Array.from(this.activeDownloads.values());
    if (userId) {
      return processes.filter(p => p.userId === userId);
    }
    return processes;
  }

  /**
   * Utility delay function
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new PastPapersDownloaderService();
