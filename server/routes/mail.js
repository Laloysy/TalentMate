const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { renderCareEmail } = require('../services/emailService');
const { logInteraction } = require('../services/interactions');
const { mailLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(authMiddleware);

router.post('/preview', mailLimiter, async (req, res) => {
  try {
    const { eventId, contactId, event = {}, contact = {}, bodyOverride } = req.body;
    const data = await loadMailContext(req.user.id, eventId, contactId, event, contact);
    const preview = renderCareEmail({ event: data.event, contact: data.contact, bodyOverride });
    res.json({ success: true, data: preview });
  } catch (err) {
    console.error('Mail preview error:', err);
    res.status(500).json({ success: false, message: '生成邮件预览失败' });
  }
});

router.put('/events/:id/draft', async (req, res) => {
  try {
    const { subject, body } = req.body;
    const [events] = await pool.query(
      'SELECT id, contact_id FROM events WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (events.length === 0) {
      return res.status(404).json({ success: false, message: '事件不存在' });
    }

    await pool.query(
      `UPDATE events
       SET mail_subject = ?, mail_body_override = ?, mail_status = 'draft'
       WHERE id = ? AND user_id = ?`,
      [subject || null, body || null, req.params.id, req.user.id]
    );
    await logInteraction(pool, {
      userId: req.user.id,
      contactId: events[0].contact_id || null,
      eventId: req.params.id,
      actionType: 'mail_draft',
      title: subject || '邮件草稿已调整',
      detail: body || null,
    });
    res.json({ success: true, message: '邮件草稿已保存' });
  } catch (err) {
    console.error('Save mail draft error:', err);
    res.status(500).json({ success: false, message: '保存邮件草稿失败' });
  }
});

async function loadMailContext(userId, eventId, contactId, event, contact) {
  let finalEvent = event || {};
  let finalContact = contact || {};

  if (eventId) {
    const [events] = await pool.query('SELECT * FROM events WHERE id = ? AND user_id = ?', [eventId, userId]);
    if (events.length) finalEvent = events[0];
  }

  const resolvedContactId = contactId || finalEvent.contact_id;
  if (resolvedContactId) {
    const [contacts] = await pool.query('SELECT * FROM contacts WHERE id = ? AND user_id = ?', [resolvedContactId, userId]);
    if (contacts.length) finalContact = contacts[0];
  }

  return { event: finalEvent, contact: finalContact };
}

module.exports = router;
