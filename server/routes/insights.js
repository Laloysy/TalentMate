const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/relationship-heatmap', async (req, res) => {
  try {
    const [contacts] = await pool.query(
      `SELECT c.*,
              MAX(CASE WHEN e.start_time <= NOW() THEN e.start_time ELSE NULL END) AS last_event_at,
              MAX(CASE WHEN l.occurred_at <= NOW() THEN l.occurred_at ELSE NULL END) AS last_log_at,
              MIN(CASE WHEN e.start_time > NOW() THEN e.start_time ELSE NULL END) AS next_event_at,
              COUNT(DISTINCT e.id) AS event_count,
              COUNT(DISTINCT l.id) AS log_count
       FROM contacts c
       LEFT JOIN events e ON e.contact_id = c.id AND e.user_id = c.user_id
       LEFT JOIN interaction_logs l ON l.contact_id = c.id AND l.user_id = c.user_id
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY next_event_at IS NULL ASC, last_event_at IS NULL DESC, last_event_at ASC, c.updated_at DESC`,
      [req.user.id]
    );

    const now = new Date();
    const data = contacts.map((contact) => {
      const lastRaw = maxDateString(contact.last_event_at, contact.last_log_at);
      const last = lastRaw ? new Date(String(lastRaw).replace(' ', 'T')) : null;
      const next = contact.next_event_at ? new Date(String(contact.next_event_at).replace(' ', 'T')) : null;
      const days = last ? Math.floor((now - last) / 86400000) : null;
      const isCandidate = contact.contact_type === 'candidate';
      const warnAt = isCandidate ? 7 : 30;
      const dangerAt = isCandidate ? 14 : 45;
      let status = 'healthy';
      if (next) status = 'scheduled';
      else if (days === null) status = 'new';
      else if (days >= dangerAt) status = 'danger';
      else if (days >= warnAt) status = 'warning';

      return {
        ...contact,
        last_interaction_at: lastRaw,
        next_event_at: contact.next_event_at,
        days_since_interaction: days,
        status,
        reason: buildReason(contact, status, days, isCandidate, next),
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error('Heatmap error:', err);
    res.status(500).json({ success: false, message: '获取关怀热力图失败' });
  }
});

function buildReason(contact, status, days, isCandidate, next) {
  if (status === 'scheduled') return `已安排 ${formatShort(next)} 的互动`;
  if (status === 'new') return '尚未记录互动';
  if (status === 'healthy') return `最近 ${days} 天内有互动`;
  if (status === 'warning') return isCandidate ? `候选人 ${days} 天未跟进` : `${days} 天未 1对1`;
  return isCandidate ? `候选人 ${days} 天未跟进，建议立即处理` : `${days} 天未关怀，建议安排沟通`;
}

function maxDateString(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return new Date(String(a).replace(' ', 'T')) > new Date(String(b).replace(' ', 'T')) ? a : b;
}

function formatShort(date) {
  if (!date || Number.isNaN(date.getTime())) return '未来';
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${m}/${d} ${h}:${min}`;
}

module.exports = router;
