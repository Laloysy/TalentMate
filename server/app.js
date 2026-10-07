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
const { globalLimiter } = require('./middleware/rateLimit');
const log = require('./services/logger');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// --------------- Middleware ---------------
app.use(cors());
// 限制 JSON 体积：CSV 粘贴导入是最大的合法载荷，1MB 足够，
// 同时避免超大请求体拖垮进程（原实现用默认的 100kb，
// 会让「粘贴 CSV 导入」在大批量时直接 413）
app.use(express.json({ limit: '1mb' }));

// 透传真实客户端 IP，让限流能正确区分来源
// （部署在 Nginx 反向代理之后，req.ip 否则会全是 127.0.0.1）
app.set('trust proxy', 1);

// 全局兜底限流，数值宽松，仅用于挡住明显的滥用与爬取
app.use(globalLimiter);

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
  // 用脱敏日志，避免 err 里带出连接串、SQL 细节或凭证
  log.error('Unhandled error:', err);
  // 对外只返回通用信息：err.message 可能包含数据库结构或内部路径
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
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
