import express from 'express';
import path from 'path';
import { randomUUID } from 'crypto';

const router = express.Router();
const MAX_BOOK_SIZE = 50 * 1024 * 1024;
const MAX_COVER_SIZE = 10 * 1024 * 1024;

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
