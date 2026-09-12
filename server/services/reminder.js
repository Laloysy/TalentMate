/**
 * Reminder Service.
 * Scans every 15 seconds for events needing reminders.
 * Sends email notifications and marks events as reminded.
 */
const { sendReminderEmail, renderCareEmail } = require('./emailService');
const { logInteraction } = require('./interactions');

let pool = null;
let intervalId = null;

/**
 * Initialize the reminder scheduler.
 * Called once when the server starts.
 */
function initReminder(dbPool) {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  pool = dbPool || require('../db');
  console.log('[Reminder] Running startup check...');
  checkAndSendReminders();
  intervalId = setInterval(() => checkAndSendReminders(), 15000);
  console.log('[Reminder] Scheduler started (every 15 seconds)');
}

/**
 * Query events that need reminders and process them.
 */
async function checkAndSendReminders() {
  if (!pool) return;

  try {
    // Threshold in LOCAL time (dateStrings:true stores DATETIME as-is, no UTC conversion)
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const threshold = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    console.log('[Reminder] Threshold:', threshold);

    // Find events where reminder time has arrived and not yet reminded
    const [events] = await pool.query(`
      SELECT e.*, u.email, u.username,
             c.name AS contact_name, c.email AS contact_email,
             c.department AS contact_department, c.role AS contact_role,
             c.contact_type, c.avatar_color
      FROM events e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN contacts c ON c.id = e.contact_id AND c.user_id = e.user_id
      WHERE e.reminded = 0
        AND DATE_SUB(e.start_time, INTERVAL e.reminder MINUTE) <= ?
    `, [threshold]);

    console.log(`[Reminder] Scan found ${events.length} event(s)`);

    for (const event of events) {
      if (event.contact_email) {
        console.log('[Reminder] Sending care email for:', event.title, 'to', event.contact_email);
        const preview = renderCareEmail({
          contact: {
            name: event.contact_name,
            email: event.contact_email,
            department: event.contact_department,
            role: event.contact_role,
          },
          event: {
            title: event.title,
            start_time: formatDateTimeStr(event.start_time),
            event_type: event.event_type,
            mail_subject: event.mail_subject,
            mail_body_override: event.mail_body_override,
          },
        });
        await sendHtmlEmail(event.contact_email, preview.subject, preview.body, preview.html);
        await pool.query('UPDATE events SET mail_status = ? WHERE id = ?', ['sent', event.id]);
        await logInteraction(pool, {
          userId: event.user_id,
          contactId: event.contact_id,
          eventId: event.id,
          actionType: 'mail_sent',
          title: preview.subject,
          detail: `关怀邮件已发送至 ${event.contact_email}`,
        });
      } else {
        // Send email reminder to the owner when no target contact is bound.
        console.log('[Reminder] Sending email for:', event.title, 'to', event.email);
        await sendReminderEmail(
          event.email,
          event.title,
          formatDateTimeStr(event.start_time),
          event.reminder
        );
      }

      // Mark as reminded
      await pool.query('UPDATE events SET reminded = 1 WHERE id = ?', [event.id]);

      console.log(`[Reminder] Processed event #${event.id}: "${event.title}" for user ${event.username}`);
    }
  } catch (err) {
    console.error('[Reminder] Error checking reminders:', err);
  }
}

async function sendHtmlEmail(to, subject, text, html) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: parseInt(process.env.SMTP_PORT, 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    dns: { family: 4 },
    connectionTimeout: 15000,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}

/**
 * Format a Date or date string to "YYYY-MM-DD HH:mm".
 */
function formatDateTimeStr(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

module.exports = { initReminder, checkAndSendReminders };
