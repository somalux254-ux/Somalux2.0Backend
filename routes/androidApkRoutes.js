import express from 'express';

const router = express.Router();
const APK_URL = 'https://github.com/somalux254-ux/Somalux2.0Frontend/releases/latest/download/somalux.apk';
const LATEST_RELEASE_URL = 'https://api.github.com/repos/somalux254-ux/Somalux2.0Frontend/releases/latest';

const compareVersions = (currentVersion, latestVersion) => {
  const current = String(currentVersion || '0').replace(/^v/i, '').split('.').map(Number);
  const latest = String(latestVersion || '0').replace(/^v/i, '').split('.').map(Number);
  const length = Math.max(current.length, latest.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = Number.isFinite(current[index]) ? current[index] : 0;
    const latestPart = Number.isFinite(latest[index]) ? latest[index] : 0;
    if (latestPart !== currentPart) return latestPart > currentPart;
  }

  return false;
};

router.get('/api/android/apk/status', async (req, res) => {
  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' }
    });

    if (!response.ok) return res.json({ updateAvailable: false });

    const release = await response.json();
    const latestVersion = release.tag_name || release.name || '0';
    return res.json({
      latestVersion,
      updateAvailable: compareVersions(req.query.currentVersion, latestVersion)
    });
  } catch (error) {
    console.warn('[apk-status] Failed to check release:', error.message);
    return res.json({ updateAvailable: false });
  }
});

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
