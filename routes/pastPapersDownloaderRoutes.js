import express from 'express';
import pastPapersService from '../services/pastPapersDownloaderService.js';

const router = express.Router();

/**
 * GET /api/elib/pastpapers/schools
 * Fetch all schools/communities available
 */
router.get('/schools', async (req, res) => {
  try {
    const schools = await pastPapersService.getSchools();
    res.json({
      ok: true,
      schools,
      count: schools.length
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/elib/pastpapers/school/:schoolHandle/papers
 * Fetch papers from a specific school
 * Query: ?page=1
 */
router.get('/school/:schoolHandle/papers', async (req, res) => {
  try {
    const { schoolHandle } = req.params;
    const page = parseInt(req.query.page) || 1;

    const result = await pastPapersService.getSchoolPapers(schoolHandle, page);
    res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/elib/pastpapers/paper/:paperId
 * Get details and download links for a specific paper
 */
router.get('/paper/:paperId', async (req, res) => {
  try {
    const { paperId } = req.params;
    const details = await pastPapersService.getPaperDetails(paperId);
    
    res.json({
      ok: true,
      ...details
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * POST /api/elib/pastpapers/bulk-download
 * Start a bulk download process
 * Body: { schoolId, schoolName, userId }
 */
router.post('/bulk-download', async (req, res) => {
  try {
    const { schoolId, schoolName, userId } = req.body;

    if (!schoolId || !schoolName) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: schoolId, schoolName'
      });
    }

    const process = await pastPapersService.startBulkDownload({
      schoolId,
      schoolName,
      userId
    });

    res.json({
      ok: true,
      process
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/elib/pastpapers/download/status/:processId
 * Get status of a download process
 */
router.get('/download/status/:processId', (req, res) => {
  try {
    const { processId } = req.params;
    const process = pastPapersService.getProcessStatus(processId);

    if (!process) {
      return res.status(404).json({
        ok: false,
        error: 'Process not found'
      });
    }

    res.json({
      ok: true,
      process
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * POST /api/elib/pastpapers/download/pause/:processId
 * Pause a download process
 */
router.post('/download/pause/:processId', (req, res) => {
  try {
    const { processId } = req.params;
    const success = pastPapersService.pauseDownload(processId);

    res.json({
      ok: success,
      message: success ? 'Download paused' : 'Could not pause process'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * POST /api/elib/pastpapers/download/resume/:processId
 * Resume a paused download
 */
router.post('/download/resume/:processId', (req, res) => {
  try {
    const { processId } = req.params;
    const success = pastPapersService.resumeDownload(processId);

    res.json({
      ok: success,
      message: success ? 'Download resumed' : 'Could not resume process'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * POST /api/elib/pastpapers/download/stop/:processId
 * Stop a download process
 */
router.post('/download/stop/:processId', (req, res) => {
  try {
    const { processId } = req.params;
    const success = pastPapersService.stopDownload(processId);

    res.json({
      ok: success,
      message: success ? 'Download stopped' : 'Could not stop process'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/elib/pastpapers/downloads/processes
 * Get all download processes (optionally filtered by user)
 * Query: ?userId=123
 */
router.get('/downloads/processes', (req, res) => {
  try {
    const { userId } = req.query;
    const processes = pastPapersService.getAllProcesses(userId);

    res.json({
      ok: true,
      processes,
      count: processes.length
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

export default router;
