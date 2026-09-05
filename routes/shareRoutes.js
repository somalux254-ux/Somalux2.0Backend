import express from 'express';

const router = express.Router();

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

router.get('/og', (req, res) => {
  const title = req.query.title || 'SomaLux Book';
  const description = req.query.description || 'Read this book on SomaLux.';
  const image = req.query.image || 'https://somalux.co.ke/somalux-logo.svg';
  const bookId = req.query.id || '';
  const websiteUrl = `https://somalux.co.ke/books?id=${encodeURIComponent(bookId)}`;
  const userAgent = req.get('user-agent') || '';
  const isCrawler = /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|slackbot|telegrambot|discordbot/i.test(userAgent);

  if (!isCrawler) return res.redirect(302, websiteUrl);

  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:type" content="book">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:url" content="${escapeHtml(websiteUrl)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    <link rel="canonical" href="${escapeHtml(websiteUrl)}">
  </head>
  <body><a href="${escapeHtml(websiteUrl)}">Open this book on SomaLux</a></body>
</html>`);
});

router.get('/share/health', (req, res) => {
  res.json({ ok: true, service: 'share-routes' });
});

export default router;
