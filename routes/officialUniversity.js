import express from 'express';
import * as cheerio from 'cheerio';

const router = express.Router();

const isBlockedHost = (hostname) => (
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '0.0.0.0' ||
  hostname === '::1' ||
  hostname.endsWith('.local') ||
  hostname.endsWith('.internal')
);

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

const parseAllowedUrl = (rawUrl) => {
  const parsedUrl = new URL(String(rawUrl || '').trim());
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || isBlockedHost(parsedUrl.hostname)) {
    throw new Error('Invalid external URL');
  }
  return parsedUrl;
};

router.get('/api/university/official', async (req, res) => {
  let officialUrl;
  try {
    officialUrl = parseAllowedUrl(req.query.url);
  } catch {
    return res.status(400).json({ error: 'Invalid official website URL' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(officialUrl.href, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'SomaLux University Directory/1.0'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Official website unavailable' });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('html')) {
      return res.status(415).json({ error: 'Official URL did not return HTML' });
    }

    const html = (await response.text()).slice(0, 2_000_000);
    const $ = cheerio.load(html);
    const images = [];
    const rejectedImagePattern = /logo|favicon|icon|sprite|avatar|seal|emblem|coat[-_ ]of[-_ ]arms|placeholder|banner|congrat|portrait|prof|award|ceremony/i;

    const addImage = (value, score = 0, label = '') => {
      const imageUrl = toAbsoluteUrl(value, officialUrl.href);
      if (!imageUrl || images.some((image) => image.url === imageUrl)) return;
      const penalty = rejectedImagePattern.test(`${imageUrl} ${label}`) ? 80 : 0;
      images.push({ url: imageUrl, score: score - penalty });
    };

    $('meta[property="og:image"], meta[property="og:image:url"], meta[name="twitter:image"]').each((_, element) => {
      addImage($(element).attr('content'), 100);
    });

    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const json = JSON.parse($(element).contents().text());
        const entries = Array.isArray(json) ? json : [json];
        entries.forEach((entry) => {
          const image = entry?.image;
          if (typeof image === 'string') addImage(image, 90);
          if (Array.isArray(image)) image.forEach((value) => addImage(value, 90));
          if (image?.url) addImage(image.url, 90);
        });
      } catch {
        // Ignore malformed JSON-LD from the official page.
      }
    });

    $('img').each((_, element) => {
      const source = $(element).attr('src') || $(element).attr('data-src') || $(element).attr('data-lazy-src');
      const label = `${$(element).attr('alt') || ''} ${source || ''}`;
      const score = /campus|university|college|building|library|students|front|dsc[_-]/i.test(label) ? 75 : 40;
      addImage(source, score, label);
    });

    const hasSuitableImage = images.some((image) => image.score > 20);
    const rankedImages = images
      .sort((left, right) => right.score - left.score)
      .filter((image) => image.score > 20 || !hasSuitableImage)
      .map((image) => image.url);

    return res.json({
      website_url: officialUrl.href,
      name: $('meta[property="og:site_name"]').attr('content') || $('title').first().text().trim(),
      description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
      images: rankedImages.slice(0, 5),
      source: 'official_website'
    });
  } catch (error) {
    return res.status(502).json({ error: 'Could not read official website', message: error.message });
  } finally {
    clearTimeout(timeout);
  }
});

router.get('/api/university/image', async (req, res) => {
  let imageUrl;
  let referrer = null;
  try {
    imageUrl = parseAllowedUrl(req.query.url);
    if (req.query.referrer) referrer = parseAllowedUrl(req.query.referrer);
  } catch {
    return res.status(400).json({ error: 'Invalid image URL' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(imageUrl.href, {
      signal: controller.signal,
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
        ...(referrer ? { referer: referrer.origin } : {})
      }
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.startsWith('image/')) {
      return res.status(502).json({ error: 'Image unavailable' });
    }

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    return res.status(502).json({ error: 'Could not load image', message: error.message });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;