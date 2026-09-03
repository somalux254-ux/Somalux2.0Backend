import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { WebSocketServer } from 'ws';

import featureFlagsRouter from './routes/featureFlags.js';
import emailNotificationsRouter from './routes/emailNotifications.js';
import pastPapersDownloaderRoutes from './routes/pastPapersDownloaderRoutes.js';
import pastPaperExtractRoute from './routes/pastPaperExtractRoute.js';
import firstPageExtractRoute from './routes/firstPageExtractRoute.js';
import shareRoutes from './routes/shareRoutes.js';
import bookUploadRoutes from './routes/bookUploadRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import userRoleRoutes from './routes/userRoleRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 5000);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseServiceRoleKey) {
  global.supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });
  console.log('✅ Supabase admin client initialized');
} else {
  console.warn('⚠️ Supabase admin credentials missing; DB-backed routes will degrade gracefully');
}

if (supabaseUrl && supabaseAnonKey) {
  global.supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true }
  });
}

app.use(featureFlagsRouter);
app.use('/api/admin', emailNotificationsRouter);
app.use('/api/elib/pastpapers', pastPapersDownloaderRoutes);
app.use('/api/past-papers', pastPaperExtractRoute);
app.use('/api/past-papers', firstPageExtractRoute);
app.use('/api', shareRoutes);
app.use(bookUploadRoutes);
app.use(submissionRoutes);
app.use(userRoleRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    service: 'backend',
    timestamp: new Date().toISOString(),
    node: process.version,
    supabaseConfigured: Boolean(supabaseUrl && supabaseServiceRoleKey),
  });
});

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'SomaLux backend',
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Route not found', path: req.originalUrl });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket connected');

  ws.on('error', (err) => {
    console.warn('WebSocket client error:', err.message);
  });

  ws.on('message', (message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (payload?.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid websocket message' }));
    }
  });

  ws.on('close', () => console.log('WebSocket disconnected'));
});

wss.on('error', (err) => {
  console.warn('WebSocket server error:', err.message);
});

server.listen(PORT, () => {
  console.log(`backend listening on http://localhost:${PORT}`);
});

export default app;
