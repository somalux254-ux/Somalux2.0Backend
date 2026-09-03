import express from 'express';

const router = express.Router();

router.get('/share/health', (req, res) => {
  res.json({ ok: true, service: 'share-routes' });
});

export default router;
