import express from 'express';
import path from 'path';
import { randomUUID } from 'crypto';

const router = express.Router();
const MAX_BOOK_SIZE = 50 * 1024 * 1024;
const MAX_COVER_SIZE = 10 * 1024 * 1024;
const signedUrlCaches = {
  books: new Map(),
  pastPapers: new Map(),
};

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function requireUser(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ ok: false, error: 'Authentication required' });

  if (!global.supabaseAdmin) {
    return res.status(503).json({ ok: false, error: 'Supabase service is not configured' });
  }

  const { data, error } = await global.supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired session' });
  }

  req.user = data.user;
  next();
}

function decodeBase64(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const payload = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
  try {
    return Buffer.from(payload, 'base64');
  } catch (error) {
    return null;
  }
}

function safeFileName(value, fallback) {
  const original = path.basename(String(value || fallback));
  const cleaned = original.replace(/[^a-zA-Z0-9._-]/g, '-');
  return cleaned || fallback;
}

function publicUrl(bucket, storagePath) {
  return global.supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
}

function getStoragePath(fileUrl, bucket) {
  if (!fileUrl) return null;
  if (!/^https?:\/\//i.test(fileUrl)) {
    return fileUrl.replace(/^\/+/, '').replace(new RegExp(`^${bucket}/`), '');
  }

  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = fileUrl.indexOf(marker);
  return markerIndex === -1 ? null : decodeURIComponent(fileUrl.slice(markerIndex + marker.length));
}

router.get('/api/elib/books/:bookId/signed-url', requireUser, async (req, res) => {
  const { bookId } = req.params;
  const startedAt = Date.now();
  console.log('[signed-url] Request started', { bookId, userId: req.user?.id });

  const cached = signedUrlCaches.books.get(bookId);
  if (cached?.expiresAt > Date.now()) {
    console.log('[signed-url] Book cache hit', { bookId, durationMs: Date.now() - startedAt });
    return res.json({ ok: true, signedUrl: cached.signedUrl, expiresIn: Math.ceil((cached.expiresAt - Date.now()) / 1000) });
  }

  const { data: book, error: bookError } = await global.supabaseAdmin
    .from('books')
    .select('file_url')
    .eq('id', bookId)
    .maybeSingle();

  if (bookError) {
    console.error('[signed-url] Book lookup failed', { bookId, error: bookError.message });
    return res.status(502).json({ ok: false, error: bookError.message });
  }
  if (!book) {
    console.warn('[signed-url] Book not found', { bookId });
    return res.status(404).json({ ok: false, error: 'Book not found' });
  }

  const storagePath = getStoragePath(book.file_url, 'elib-books');
  if (!storagePath) {
    console.warn('[signed-url] Book has no usable storage path', { bookId });
    return res.status(404).json({ ok: false, error: 'Book file is not available' });
  }

  const { data, error } = await global.supabaseAdmin.storage
    .from('elib-books')
    .createSignedUrl(storagePath, 600);

  if (error || !data?.signedUrl) {
    console.error('[signed-url] Storage URL creation failed', { bookId, error: error?.message });
    return res.status(502).json({ ok: false, error: error?.message || 'Could not create signed URL' });
  }

  signedUrlCaches.books.set(bookId, { signedUrl: data.signedUrl, expiresAt: Date.now() + 570000 });
  console.log('[signed-url] Request completed', { bookId, durationMs: Date.now() - startedAt, expiresIn: 600 });
  return res.json({ ok: true, signedUrl: data.signedUrl, expiresIn: 600 });
});

router.get('/api/elib/pastpapers/:paperId/signed-url', requireUser, async (req, res) => {
  const { paperId } = req.params;
  const startedAt = Date.now();
  console.log('[signed-url] Past paper request started', { paperId, userId: req.user?.id });

  const cached = signedUrlCaches.pastPapers.get(paperId);
  if (cached?.expiresAt > Date.now()) {
    console.log('[signed-url] Past paper cache hit', { paperId, durationMs: Date.now() - startedAt });
    return res.json({ ok: true, signedUrl: cached.signedUrl, expiresIn: Math.ceil((cached.expiresAt - Date.now()) / 1000) });
  }

  const { data: paper, error: paperError } = await global.supabaseAdmin
    .from('past_papers')
    .select('file_path, file_url')
    .eq('id', paperId)
    .maybeSingle();

  if (paperError) {
    console.error('[signed-url] Past paper lookup failed', { paperId, error: paperError.message });
    return res.status(502).json({ ok: false, error: paperError.message });
  }
  if (!paper) return res.status(404).json({ ok: false, error: 'Past paper not found' });

  const storagePath = getStoragePath(paper.file_path || paper.file_url, 'past-papers');
  if (!storagePath) return res.status(404).json({ ok: false, error: 'Past paper file is not available' });

  const { data, error } = await global.supabaseAdmin.storage
    .from('past-papers')
    .createSignedUrl(storagePath, 600);

  if (error || !data?.signedUrl) {
    console.error('[signed-url] Past paper URL creation failed', { paperId, error: error?.message });
    return res.status(502).json({ ok: false, error: error?.message || 'Could not create signed URL' });
  }

  signedUrlCaches.pastPapers.set(paperId, { signedUrl: data.signedUrl, expiresAt: Date.now() + 570000 });
  console.log('[signed-url] Past paper request completed', { paperId, durationMs: Date.now() - startedAt, expiresIn: 600 });
  return res.json({ ok: true, signedUrl: data.signedUrl, expiresIn: 600 });
});

router.post('/api/elib/books/upload-file', requireUser, async (req, res) => {
  const buffer = decodeBase64(req.body?.fileBase64);
  if (!buffer) return res.status(400).json({ ok: false, error: 'A valid base64 file is required' });
  if (buffer.length > MAX_BOOK_SIZE) return res.status(413).json({ ok: false, error: 'Book file exceeds the 50MB limit' });

  const fileName = safeFileName(req.body?.fileName, 'book.pdf');
  const storagePath = `books/${req.user.id}/${randomUUID()}-${fileName}`;
  const { error } = await global.supabaseAdmin.storage.from('elib-books').upload(storagePath, buffer, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: false,
  });

  if (error) return res.status(502).json({ ok: false, error: error.message });
  return res.json({ ok: true, path: storagePath, publicUrl: publicUrl('elib-books', storagePath) });
});

router.post('/api/elib/books/upload-cover', requireUser, async (req, res) => {
  const buffer = decodeBase64(req.body?.fileBase64);
  if (!buffer) return res.status(400).json({ ok: false, error: 'A valid base64 image is required' });
  if (buffer.length > MAX_COVER_SIZE) return res.status(413).json({ ok: false, error: 'Cover image exceeds the 10MB limit' });

  const fileName = safeFileName(req.body?.fileName, 'cover.jpg');
  const storagePath = `covers/${req.user.id}/${randomUUID()}-${fileName}`;
  const requestedType = String(req.body?.contentType || '').toLowerCase().split(';')[0];
  const extensionTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  const contentType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(requestedType)
    ? requestedType
    : extensionTypes[path.extname(fileName).toLowerCase()] || 'image/jpeg';
  const { error } = await global.supabaseAdmin.storage.from('elib-covers').upload(storagePath, buffer, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  });

  if (error) return res.status(502).json({ ok: false, error: error.message });
  return res.json({ ok: true, path: storagePath, publicUrl: publicUrl('elib-covers', storagePath) });
});

export default router;
