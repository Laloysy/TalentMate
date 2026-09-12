// Force IPv4 for all outgoing connections (fix ETIMEDOUT on IPv6-only env)
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// Load environment variables first
require('dotenv').config({ path: '../.env' });

const express = require('express');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const voiceRoutes = require('./routes/voice');
const { initReminder } = require('./services/reminder');
const { ensureSchema } = require('./services/schema');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// --------------- Middleware ---------------
app.use(cors());
app.use(express.json());

// --------------- API Routes ---------------
app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/mail', require('./routes/mail'));
app.get('/api/health', (_req, res) => { res.json({ success: true, message: 'Server is running' }); });

// Serve frontend static files (Vite build output, Docker copies to public/)
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ success: false, message: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// --------------- Start ---------------
app.listen(PORT, async () => {
  console.log(`[VoiceCalendar] Server running on http://localhost:${PORT}`);

  try {
    await ensureSchema(pool);
    console.log('[Schema] V2 schema ready');
  } catch (err) {
    console.error('[Schema] Failed to ensure schema:', err.message);
  }

  // Initialize reminder scheduler on startup
  initReminder();
});
