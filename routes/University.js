import express from 'express';
const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.REACT_APP_GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || process.env.GOOGLE_SEARCH_ENGINE_ID;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || process.env.REACT_APP_UNSPLASH_ACCESS_KEY;

const rejectedImagePattern = /logo|favicon|icon|sprite|avatar|seal|emblem|coat[-_ ]of[-_ ]arms|placeholder|banner|poster|flyer|event|congrat|portrait|award|ceremony/i;

const getGoogleImageUrl = (value) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (/google|gstatic|googleusercontent/i.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
};

const searchWikimediaImages = async (query, limit) => {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`${query} campus building`)}&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url&format=json&origin=*`;
  const response = await fetch(url, { headers: { 'user-agent': 'SomaLux University Directory/1.0' } });
  if (!response.ok) return [];
  const data = await response.json();
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  const terms = String(query).toLowerCase().split(/\s+/).filter((term) => term.length > 3 && !['university', 'college', 'campus'].includes(term));
  const results = pages
    .map((page) => ({
      title: String(page?.title || '').toLowerCase(),
      url: page?.imageinfo?.[0]?.url
    }))
    .filter(({ title, url }) => url && /\.(?:jpe?g|png|webp|gif)(?:[?#]|$)/i.test(url) && !rejectedImagePattern.test(`${title} ${url}`))
    .map((result) => ({ ...result, score: terms.filter((term) => result.title.includes(term)).length }));
  const relevant = results.filter((result) => result.score > 0);
  return (relevant.length ? relevant : results)
    .sort((left, right) => right.score - left.score)
    .map((result) => result.url)
    .slice(0, limit);
};

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
      return res.json({ universities: [], source: 'fallback' });
    }

    const kgUrl = `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(query)}&types=University&limit=${limit}&key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(kgUrl);
    
    if (!response.ok) {
      return res.json({ universities: [], source: 'fallback' });
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
      return res.json({ university: { name, description: '', website_url: '', location: '', image: '' }, source: 'fallback' });
    }

    const kgUrl = `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(name + ' university')}&types=University&key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(kgUrl);
    
    if (!response.ok) {
      return res.json({ university: { name, description: '', website_url: '', location: '', image: '' }, source: 'fallback' });
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
 * Fetch direct image candidates from Google Images.
 * GET /api/university/google-images?query=Harvard University
 */
router.get('/google-images', async (req, res) => {
  try {
    const query = String(req.query.query || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 12);
    if (!query) return res.status(400).json({ error: 'Query parameter is required' });

    if (GOOGLE_API_KEY && GOOGLE_CSE_ID) {
      const customSearchUrl = new URL('https://www.googleapis.com/customsearch/v1');
      customSearchUrl.searchParams.set('key', GOOGLE_API_KEY);
      customSearchUrl.searchParams.set('cx', GOOGLE_CSE_ID);
      customSearchUrl.searchParams.set('q', `${query} university campus buildings`);
      customSearchUrl.searchParams.set('searchType', 'image');
      customSearchUrl.searchParams.set('safe', 'active');
      customSearchUrl.searchParams.set('num', String(Math.min(limit, 10)));

      const customSearchResponse = await fetch(customSearchUrl);
      if (customSearchResponse.ok) {
        const customSearchData = await customSearchResponse.json();
        const images = (customSearchData.items || [])
          .map((item) => ({ url: item.link, label: `${item.title || ''} ${item.snippet || ''}` }))
          .filter(({ url, label }) => url && !rejectedImagePattern.test(`${url} ${label}`))
          .map(({ url }) => url);
        if (images.length) return res.json({ images, source: 'google_custom_search' });
      }
    }

    const googleUrl = `https://www.google.com/search?tbm=isch&safe=active&q=${encodeURIComponent(`${query} campus buildings`)}`;
    const response = await fetch(googleUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'
      }
    });
    if (!response.ok) {
      const fallbackImages = await searchWikimediaImages(query, limit);
      return res.json({ images: fallbackImages, source: 'wikimedia_fallback' });
    }

    const html = await response.text();
    const candidates = [];
    const seen = new Set();
    const addCandidate = (value, label = '') => {
      const imageUrl = getGoogleImageUrl(value);
      if (!imageUrl || seen.has(imageUrl) || rejectedImagePattern.test(`${imageUrl} ${label}`)) return;
      seen.add(imageUrl);
      const campusScore = /campus|building|library|hall|college|university|students|quad/i.test(`${imageUrl} ${label}`) ? 20 : 0;
      candidates.push({ url: imageUrl, score: campusScore });
    };

    const imageTagPattern = /<img\b[^>]*>/gi;
    for (const tag of html.match(imageTagPattern) || []) {
      const attributes = [...tag.matchAll(/(?:data-src|data-iurl|src)=["']([^"']+)["']/gi)];
      const label = tag.replace(/<[^>]+>/g, ' ');
      attributes.forEach(([, value]) => addCandidate(value, label));
    }

    return res.json({
      images: candidates
        .sort((left, right) => right.score - left.score)
        .map((candidate) => candidate.url)
        .slice(0, limit),
      source: 'google_images'
    });
  } catch (error) {
    console.error('Error fetching Google Images:', error);
    return res.status(502).json({ error: 'Could not fetch Google Images', message: error.message });
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

export default router;