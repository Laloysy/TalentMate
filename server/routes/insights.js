const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/**
 * 关注等级对阈值的影响。
 *
 * 阈值原本只按「员工 30/45 天、候选人 7/14 天」计算，人手不能干预。
 * 现在人工指定的 care_level 作为缩放因子：重点联系人更早进入提醒，
 * 低优先更晚提醒 —— 同样 20 天没联系，重点员工已经是「需关注」，
 * 普通员工还算正常。
 */
const CARE_WEIGHT = { high: 0.6, normal: 1, low: 1.5 };
const CARE_LABEL = { high: '重点联系人', normal: '', low: '低优先' };

/** 计算某个联系人的提醒阈值；自定义值优先于等级预设 */
function thresholdsFor(contact) {
  const isCandidate = contact.contact_type === 'candidate';
  const weight = CARE_WEIGHT[contact.care_level] ?? 1;
  const baseWarn = isCandidate ? 7 : 30;
  const baseDanger = isCandidate ? 14 : 45;

  // 预设：按等级缩放
  let warnAt = Math.max(1, Math.round(baseWarn * weight));
  let dangerAt = Math.max(warnAt + 1, Math.round(baseDanger * weight));

  // 自定义阈值（天）覆盖预设；只填一项时另一项仍用预设，但保证 danger > warn
  const cw = Number(contact.care_warn_days);
  const cd = Number(contact.care_danger_days);
  const customWarn = Number.isInteger(cw) && cw > 0;
  const customDanger = Number.isInteger(cd) && cd > 0;
  if (customWarn) warnAt = cw;
  if (customDanger) dangerAt = Math.max(warnAt + 1, cd);

  return { isCandidate, warnAt, dangerAt, weight, custom: customWarn || customDanger };
}

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
      const { isCandidate, warnAt, dangerAt, custom } = thresholdsFor(contact);
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
        // 把实际生效的阈值一并返回，便于前端解释「为什么是需关注」
        warn_at: warnAt,
        danger_at: dangerAt,
        custom_thresholds: custom,
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
  const tag = CARE_LABEL[contact.care_level] || '';
  const withTag = (text) => (tag ? `${tag} · ${text}` : text);

  if (status === 'scheduled') return withTag(`已安排 ${formatShort(next)} 的互动`);
  if (status === 'new') return tag ? `${tag} · 尚未记录互动` : '尚未记录互动';
  if (status === 'healthy') return withTag(`最近 ${days} 天内有互动`);
  if (status === 'warning') {
    return withTag(isCandidate ? `候选人 ${days} 天未跟进` : `${days} 天未 1对1`);
  }
  return withTag(isCandidate ? `候选人 ${days} 天未跟进，建议立即处理` : `${days} 天未关怀，建议安排沟通`);
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
