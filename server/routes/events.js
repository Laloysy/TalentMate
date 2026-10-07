const express = require('express');
const pool = require('../db'); // to be created
const authMiddleware = require('../middleware/auth');
const { logInteraction } = require('../services/interactions');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/events - Get events for current user
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let sql = `SELECT e.*, c.name AS contact_name, c.email AS contact_email,
                      c.department AS contact_department, c.role AS contact_role,
                      c.avatar_color AS contact_avatar_color, c.contact_type
               FROM events e
               LEFT JOIN contacts c ON c.id = e.contact_id AND c.user_id = e.user_id
               WHERE e.user_id = ?`;
    const params = [req.user.id];

    if (startDate && endDate) {
      sql += ' AND start_time >= ? AND start_time <= ?';
      params.push(startDate, endDate);
    }

    sql += ' ORDER BY start_time ASC';

    const [events] = await pool.query(sql, params);
    res.json({ success: true, data: events });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ success: false, message: '获取事件失败' });
  }
});

// POST /api/events - Create a new event manually
// 事件字段长度上限（对齐 db/init.sql 的列定义）
// 超出时会触发 MySQL 的 "Data too long for column"，落到 catch 里变成 500。
// 这里提前校验，返回明确的 400，避免把数据库错误当成服务器故障暴露出去。
const EVENT_LIMITS = {
  title: 200,        // events.title VARCHAR(200)
  event_type: 40,    // events.event_type VARCHAR(40)
  mail_subject: 200, // events.mail_subject VARCHAR(200)
  mail_status: 30,   // events.mail_status VARCHAR(30)
};

/**
 * 校验日程字段。
 * @returns {{valid:true} | {valid:false, message:string}}
 */
function validateEventFields({ title, startTime, endTime, eventType, mailSubject, mailStatus, reminder }) {
  if (!String(title).trim()) return { valid: false, message: '标题不能为空' };
  if (String(title).length > EVENT_LIMITS.title) {
    return { valid: false, message: `标题最长 ${EVENT_LIMITS.title} 个字符` };
  }

  // 时间格式：YYYY-MM-DD HH:mm(:ss)
  const timeRe = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;
  if (!timeRe.test(String(startTime))) {
    return { valid: false, message: '开始时间格式应为 YYYY-MM-DD HH:mm' };
  }
  if (endTime && !timeRe.test(String(endTime))) {
    return { valid: false, message: '结束时间格式应为 YYYY-MM-DD HH:mm' };
  }
  if (endTime && new Date(String(endTime).replace(' ', 'T')) < new Date(String(startTime).replace(' ', 'T'))) {
    return { valid: false, message: '结束时间不能早于开始时间' };
  }

  if (eventType && String(eventType).length > EVENT_LIMITS.event_type) {
    return { valid: false, message: `关怀类型最长 ${EVENT_LIMITS.event_type} 个字符` };
  }
  if (mailSubject && String(mailSubject).length > EVENT_LIMITS.mail_subject) {
    return { valid: false, message: `邮件主题最长 ${EVENT_LIMITS.mail_subject} 个字符` };
  }
  if (mailStatus && String(mailStatus).length > EVENT_LIMITS.mail_status) {
    return { valid: false, message: `邮件状态最长 ${EVENT_LIMITS.mail_status} 个字符` };
  }

  if (reminder !== undefined && reminder !== null && reminder !== '') {
    const n = Number(reminder);
    if (!Number.isInteger(n) || n < 0 || n > 1440) {
      return { valid: false, message: '提前提醒应为 0–1440 之间的整数（分钟）' };
    }
  }

  return { valid: true };
}

router.post('/', async (req, res) => {
  try {
    const { title, startTime, endTime, reminder, contactId, eventType, mailStatus, mailSubject, mailBodyOverride } = req.body;

    if (!title || !startTime) {
      return res.status(400).json({ success: false, message: '标题和开始时间为必填项' });
    }

    const validation = validateEventFields({
      title, startTime, endTime, eventType, mailSubject, mailStatus, reminder,
    });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const [result] = await pool.query(
      `INSERT INTO events
       (user_id, title, start_time, end_time, reminder, contact_id, event_type, mail_status, mail_subject, mail_body_override)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        title,
        startTime,
        endTime || null,
        reminder || 10,
        contactId || null,
        eventType || 'general',
        mailStatus || 'none',
        mailSubject || null,
        mailBodyOverride || null,
      ]
    );

    if (contactId) {
      await logInteraction(pool, {
        userId: req.user.id,
        contactId,
        eventId: result.insertId,
        actionType: 'event_created',
        title,
        detail: `创建了 ${eventType || 'general'} 日程`,
        occurredAt: startTime,
      });
    }

    res.status(201).json({
      success: true,
      message: '事件创建成功',
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ success: false, message: '创建事件失败' });
  }
});

// PUT /api/events/:id - Update an event (partial update)
router.put('/:id', async (req, res) => {
  try {
    const { title, startTime, endTime, reminder, reminded, contactId, eventType, mailStatus, mailSubject, mailBodyOverride } = req.body;

    // Fetch original event first
    const [existing] = await pool.query(
      'SELECT * FROM events WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '事件不存在或无权操作' });
    }

    const ev = existing[0];
    const newTitle = title !== undefined ? title : ev.title;
    const newStart = startTime !== undefined && startTime !== null ? startTime : ev.start_time;
    const newEnd = endTime !== undefined ? endTime : ev.end_time;
    const newReminder = reminder !== undefined ? reminder : ev.reminder;
    const newReminded = reminded !== undefined ? reminded : ev.reminded;
    const newContactId = contactId !== undefined ? (contactId || null) : ev.contact_id;
    const newEventType = eventType !== undefined ? eventType : ev.event_type;
    const newMailStatus = mailStatus !== undefined ? mailStatus : ev.mail_status;
    const newMailSubject = mailSubject !== undefined ? mailSubject : ev.mail_subject;
    const newMailBodyOverride = mailBodyOverride !== undefined ? mailBodyOverride : ev.mail_body_override;

    // 与创建接口同样的字段校验：超长/格式错误应返回 400，
    // 而不是让 MySQL 的 "Data too long" 冒泡成 500
    const validation = validateEventFields({
      title: newTitle,
      startTime: newStart,
      endTime: newEnd,
      eventType: newEventType,
      mailSubject: newMailSubject,
      mailStatus: newMailStatus,
      reminder: newReminder,
    });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    // Generate intelligent feedback message (same logic as voice.js)
    const titleChanged = title !== undefined && title !== ev.title;
    const timeChanged = (startTime !== undefined && startTime !== null) || (endTime !== undefined);
    const startFmt = newStart ? new Date(newStart).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'}) : '';
    const endFmt = newEnd ? new Date(newEnd).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'}) : '';
    let msg = '事件更新成功';
    if (titleChanged && timeChanged) {
      msg = `已将「${ev.title}」的标题改为「${newTitle}」，时间调整为 ${startFmt}${endFmt ? ' - ' + endFmt : ''}`;
    } else if (timeChanged) {
      msg = `已将「${ev.title}」的时间修改为 ${startFmt}${endFmt ? ' - ' + endFmt : ''}`;
    } else if (titleChanged) {
      msg = `已将「${ev.title}」的标题改为「${newTitle}」`;
    }

    await pool.query(
      `UPDATE events
       SET title = ?, start_time = ?, end_time = ?, reminder = ?, reminded = ?,
           contact_id = ?, event_type = ?, mail_status = ?, mail_subject = ?, mail_body_override = ?
       WHERE id = ? AND user_id = ?`,
      [
        newTitle,
        newStart,
        newEnd,
        newReminder,
        newReminded,
        newContactId,
        newEventType,
        newMailStatus,
        newMailSubject,
        newMailBodyOverride,
        req.params.id,
        req.user.id,
      ]
    );

    if (newContactId) {
      await logInteraction(pool, {
        userId: req.user.id,
        contactId: newContactId,
        eventId: req.params.id,
        actionType: 'event_updated',
        title: newTitle,
        detail: msg,
        occurredAt: newStart,
      });
    }

    // Return the full updated record
    const [updatedRows] = await pool.query(
      `SELECT e.*, c.name AS contact_name, c.email AS contact_email,
              c.department AS contact_department, c.role AS contact_role,
              c.avatar_color AS contact_avatar_color, c.contact_type
       FROM events e
       LEFT JOIN contacts c ON c.id = e.contact_id AND c.user_id = e.user_id
       WHERE e.id = ? AND e.user_id = ?`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true, message: msg, data: updatedRows[0] });
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ success: false, message: '更新事件失败' });
  }
});

// DELETE /api/events/:id - Delete an event
router.delete('/:id', async (req, res) => {
  try {
    const [events] = await pool.query(
      'SELECT * FROM events WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (events.length === 0) {
      return res.status(404).json({ success: false, message: '事件不存在或无权操作' });
    }
    const ev = events[0];

    if (ev.contact_id) {
      await pool.query(
        `DELETE FROM interaction_logs
         WHERE user_id = ? AND event_id = ? AND action_type IN ('event_created', 'event_updated', 'mail_draft')`,
        [req.user.id, ev.id]
      );
      await logInteraction(pool, {
        userId: req.user.id,
        contactId: ev.contact_id,
        eventId: ev.id,
        actionType: 'event_cancelled',
        title: `已取消：${ev.title}`,
        detail: `原定时间：${ev.start_time}`,
      });
    }

    await pool.query(
      'DELETE FROM events WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    res.json({ success: true, message: '事件已删除' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ success: false, message: '删除事件失败' });
  }
});

module.exports = router;
