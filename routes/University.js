const express = require('express');
const router = express.Router();
const fetch = require('node-fetch'); // npm install node-fetch@2

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.REACT_APP_GOOGLE_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || process.env.REACT_APP_UNSPLASH_ACCESS_KEY;

/**
 * Search universities via Google Knowledge Graph (server-side proxy)
 * GET /api/university/search?query=harvard&limit=10
 */
router.get('/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    if (!GOOGLE_API_KEY) {
      return res.status(503).json({ 
        error: 'Google API key not configured',
        fallback: true 
      });
    }

    const kgUrl = `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(query)}&types=University&limit=${limit}&key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(kgUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Knowledge Graph error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Google Knowledge Graph API error',
        status: response.status 
      });
    }

    const data = await response.json();
    const universities = data.itemListElement?.map(item => ({
      name: item.result.name,
      description: item.result.detailedDescription?.articleBody || '',
      website_url: item.result.detailedDescription?.url || '',
      image: item.result.image?.contentUrl || '',
    })) || [];

    res.json({ universities, source: 'google' });
  } catch (error) {
    console.error('Error in university search:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * Get university details via Google Knowledge Graph
 * GET /api/university/details?name=Harvard University
 */
router.get('/details', async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: 'Name parameter is required' });
    }

    if (!GOOGLE_API_KEY) {
      return res.status(503).json({ 
        error: 'Google API key not configured',
        fallback: true 
      });
    }

    const kgUrl = `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(name + ' university')}&types=University&key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(kgUrl);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Google Knowledge Graph API error' 
      });
    }

    const data = await response.json();
    const result = data.itemListElement?.[0]?.result;

    if (!result) {
      return res.status(404).json({ error: 'University not found' });
    }

    const universityData = {
      name: result.name || name,
      description: result.detailedDescription?.articleBody || '',
      website_url: result.detailedDescription?.url || '',
      location: result.address?.addressLocality || '',
      image: result.image?.contentUrl || '',
    };

    res.json({ university: universityData, source: 'google' });
  } catch (error) {
    console.error('Error fetching university details:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * Fetch images from Unsplash (server-side proxy)
 * GET /api/university/images?query=harvard
 */
router.get('/images', async (req, res) => {
  try {
    const { query, perPage = 5 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    if (!UNSPLASH_ACCESS_KEY) {
      return res.status(503).json({ 
        error: 'Unsplash API key not configured' 
      });
    }

    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' university campus')}&per_page=${perPage}&client_id=${UNSPLASH_ACCESS_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Unsplash API error' 
      });
    }

    const data = await response.json();
    const images = data.results.map(photo => ({
      url: photo.urls.regular,
      thumb: photo.urls.thumb,
      alt: photo.alt_description || query,
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
    }));

    res.json({ images, source: 'unsplash' });
  } catch (error) {
    console.error('Error fetching Unsplash images:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

module.exports = router;