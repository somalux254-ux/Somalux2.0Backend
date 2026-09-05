import express from 'express';

const router = express.Router();
const APK_URL = 'https://github.com/somalux254-ux/Somalux2.0Frontend/releases/latest/download/somalux.apk';

router.get('/api/android/apk/download', async (req, res) => {
  try {
    if (global.supabaseAdmin) {
      const { error } = await global.supabaseAdmin
        .from('android_apk_downloads')
        .insert({
          user_agent: req.get('user-agent') || null,
          referer: req.get('referer') || null,
          source: req.query.source || 'website'
        });

      if (error) console.warn('[apk-download] Failed to record event:', error.message);
      else console.log('[apk-download] Download recorded', { source: req.query.source || 'website' });
    }
  } catch (error) {
    console.warn('[apk-download] Metrics error:', error.message);
  }

  return res.redirect(302, APK_URL);
});

export default router;
