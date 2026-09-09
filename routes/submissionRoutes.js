import express from 'express';

const router = express.Router();

async function requireContentAdmin(req, res, next) {
  if (!global.supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase service is not configured' });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  let authenticatedUser = null;

  if (token) {
    const { data, error } = await global.supabaseAdmin.auth.getUser(token);
    if (error) {
      console.warn('[requireContentAdmin] Invalid bearer token:', error.message || error);
    } else {
      authenticatedUser = data?.user || null;
    }
  }

  const actorId = authenticatedUser?.id || req.headers['x-actor-id'];
  const actorEmail = authenticatedUser?.email || req.headers['x-actor-email'];

  if (!actorId && !actorEmail) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let query = global.supabaseAdmin
    .from('profiles')
    .select('id, role, is_active')
    .in('role', ['admin', 'editor', 'moderator'])
    .eq('is_active', true)
    .limit(1);

  query = actorId ? query.eq('id', actorId) : query.ilike('email', actorEmail || '');
  const { data, error } = await query.maybeSingle();
  if (error || !data) return res.status(403).json({ error: 'Administrator access required' });

  req.actor = data;
  next();
}

function tableForType(type) {
  if (type === 'books') return 'book_submissions';
  if (type === 'past_papers') return 'past_paper_submissions';
  return null;
}

router.get('/api/elib/submissions', requireContentAdmin, async (req, res) => {
  const table = tableForType(req.query.type || 'books');
  if (!table) return res.json({ submissions: [] });

  let query = global.supabaseAdmin.from(table).select('*').order('created_at', { ascending: false });
  if (req.query.status) query = query.eq('status', req.query.status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ submissions: data || [] });
});

router.get('/api/elib/submissions/summary', requireContentAdmin, async (req, res) => {
  const books = await global.supabaseAdmin
    .from('book_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const booksPending = books.error ? 0 : books.count || 0;
  return res.json({
    booksPending,
    pastPapersPending: 0,
    universitiesPending: 0,
    totalPending: booksPending,
  });
});

router.post('/api/elib/submissions/:id/approve', requireContentAdmin, async (req, res) => {
  const table = tableForType(req.query.type || 'books');
  if (!table) return res.status(400).json({ error: 'Unsupported submission type' });

  const { data: submission, error: fetchError } = await global.supabaseAdmin
    .from(table)
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!submission) return res.status(404).json({ error: 'Submission not found' });

  if (table === 'book_submissions') {
    const { data: book, error: bookError } = await global.supabaseAdmin
      .from('books')
      .insert({
        title: submission.title,
        author: submission.author || '',
        description: submission.description || '',
        isbn: submission.isbn || null,
        year: submission.year || null,
        language: submission.language || null,
        pages: submission.pages || null,
        publisher: submission.publisher || null,
        file_url: submission.file_url || null,
        file_path: submission.file_path || submission.file_url || null,
        cover_image_url: submission.cover_url || null,
        cover_path: submission.cover_path || null,
        file_size: submission.file_size || null,
        uploaded_by: submission.uploaded_by || null,
        is_published: true,
      })
      .select()
      .single();
    if (bookError) return res.status(500).json({ error: bookError.message, details: bookError.details });
  }

  const { error: updateError } = await global.supabaseAdmin
    .from(table)
    .update({ status: 'approved', reviewed_by: req.actor.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', req.params.id);
  if (updateError) return res.status(500).json({ error: updateError.message });
  return res.json({ ok: true });
});

router.post('/api/elib/submissions/:id/reject', requireContentAdmin, async (req, res) => {
  const table = tableForType(req.query.type || 'books');
  if (!table) return res.status(400).json({ error: 'Unsupported submission type' });

  const { error } = await global.supabaseAdmin
    .from(table)
    .update({
      status: 'rejected',
      rejection_reason: req.body?.reason || '',
      reviewed_by: req.actor.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

export default router;
