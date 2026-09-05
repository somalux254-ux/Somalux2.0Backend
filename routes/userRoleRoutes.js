import express from 'express';

const router = express.Router();
const SUPER_ADMIN_EMAILS = new Set([
  'campuslives254@gmail.com',
  'paltechsomalux@gmail.com',
  'eliblearning@gmail.com',
]);
const ALLOWED_ROLES = new Set(['user', 'viewer', 'editor', 'admin', 'moderator', 'super_admin']);
const ALLOWED_TIERS = new Set(['basic', 'premium', 'premium_pro', 'vip']);

async function requireSuperAdmin(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token || !global.supabaseAdmin) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  const { data, error } = await global.supabaseAdmin.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email || !SUPER_ADMIN_EMAILS.has(email)) {
    return res.status(403).json({ ok: false, error: 'Only a super admin can assign roles' });
  }

  req.actor = data.user;
  next();
}

async function requireAdmin(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token || !global.supabaseAdmin) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  const { data: userData, error: userError } = await global.supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired session' });
  }

  const { data: profile, error: profileError } = await global.supabaseAdmin
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileError || !profile?.is_active || !['admin', 'moderator', 'editor', 'super_admin'].includes(profile.role)) {
    return res.status(403).json({ ok: false, error: 'Administrator access required' });
  }

  req.actor = { ...userData.user, profile };
  next();
}

router.patch('/api/elib/users/:id/role', requireSuperAdmin, async (req, res) => {
  const role = String(req.body?.role || '').trim().toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    return res.status(400).json({ ok: false, error: `Invalid role: ${role || 'missing'}` });
  }

  const { data, error } = await global.supabaseAdmin
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('id, email, display_name, full_name, role, is_active')
    .maybeSingle();

  if (error) return res.status(500).json({ ok: false, error: error.message });
  if (!data) return res.status(404).json({ ok: false, error: 'User profile not found' });
  return res.json({ ok: true, data });
});

router.patch('/api/elib/users/:id/tier', requireAdmin, async (req, res) => {
  const tier = String(req.body?.subscription_tier || '').trim().toLowerCase();
  if (!ALLOWED_TIERS.has(tier)) {
    return res.status(400).json({ ok: false, error: `Invalid subscription tier: ${tier || 'missing'}` });
  }

  const now = new Date().toISOString();
  const { data, error } = await global.supabaseAdmin
    .from('profiles')
    .update({
      subscription_tier: tier,
      subscription_started_at: now,
      updated_at: now,
    })
    .eq('id', req.params.id)
    .select('id, email, display_name, full_name, role, subscription_tier, is_active')
    .maybeSingle();

  if (error) return res.status(500).json({ ok: false, error: error.message });
  if (!data) return res.status(404).json({ ok: false, error: 'User profile not found' });
  return res.json({ ok: true, data });
});

export default router;
