/**
 * Email Service.
 * Sends reminder emails via nodemailer using SMTP configuration from .env.
 */
const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Initialize the email transporter lazily.
 */
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: parseInt(process.env.SMTP_PORT, 10) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Fix: suppress IPv6 DNS lookup on newer Node.js versions
      dns: { family: 4 },
      connectionTimeout: 15000,
    });
  }
  return transporter;
}

/**
 * Send a reminder email for an event.
 * @param {string} to - Recipient email address
 * @param {string} eventTitle - Event title
 * @param {string} startTime - Event start time (formatted string)
 * @param {number} reminderMinutes - How many minutes before the event
 */
async function sendReminderEmail(to, eventTitle, startTime, reminderMinutes) {
  try {
    const transporter = getTransporter();
    // 该邮件同样会把用户可控内容拼进 HTML，必须转义后再插入，
    // 否则事件标题里若含 <script> / onerror 等内容会被直接渲染。
    const safeTitle = escapeHtml(eventTitle);
    const safeStart = escapeHtml(startTime);
    const safeReminder = escapeHtml(reminderMinutes);
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: `[TalentMate提醒] ${eventTitle}`,
      text: `您好！\n\n您有一个即将开始的安排：\n\n事项：${eventTitle}\n时间：${startTime}\n提前提醒：${reminderMinutes} 分钟\n\n祝您一切顺利！\n\n—— TalentMate 伴贤`,
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <div style="background:linear-gradient(135deg,#1677FF,#0052D9);padding:28px 24px;text-align:center;">
            <span style="font-size:40px;">📅</span>
            <h1 style="color:#fff;font-size:20px;margin:8px 0 0;font-weight:600;">TalentMate 关怀提醒</h1>
          </div>
          <div style="padding:24px;">
            <p style="color:#1E293B;font-size:15px;margin:0 0 16px;">您好，您有一个即将开始的安排：</p>
            <div style="background:#F8FAFD;border-radius:12px;padding:16px;">
              <div style="margin-bottom:10px;">
                <span style="color:#94A3B8;font-size:12px;">事项</span><br>
                <span style="color:#1E293B;font-size:16px;font-weight:600;">${safeTitle}</span>
              </div>
              <div style="margin-bottom:10px;">
                <span style="color:#94A3B8;font-size:12px;">🕐 开始时间</span><br>
                <span style="color:#1E293B;font-size:15px;">${safeStart}</span>
              </div>
              <div>
                <span style="color:#94A3B8;font-size:12px;">⏰ 提前提醒</span><br>
                <span style="color:#1677FF;font-size:14px;font-weight:500;">${safeReminder} 分钟</span>
              </div>
            </div>
            <p style="color:#64748B;font-size:13px;margin:20px 0 0;">祝您一切顺利！</p>
          </div>
          <div style="background:#F5F7FA;padding:12px 24px;text-align:center;">
            <span style="color:#9CA3AF;font-size:11px;">—— TalentMate 伴贤</span>
          </div>
        </div>
      `,
    });
    console.log(`[Email] Reminder sent to ${to}: ${info.messageId}`);
  } catch (err) {
    console.error('[Email] Failed to send reminder:', err.message);
  }
}

function renderCareEmail({ contact = {}, event = {}, bodyOverride = null }) {
  const name = contact.name || '伙伴';
  const eventType = event.event_type || event.eventType || 'general';
  const startTime = event.start_time || event.startTime || '';
  const title = event.title || '沟通安排';
  const subject = event.mail_subject || buildCareSubject(eventType, title, name);
  const body = bodyOverride || event.mail_body_override || buildCareBody(eventType, name, title, startTime);

  const html = `
    <div style="max-width:560px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #eef2f7;box-shadow:0 18px 50px rgba(15,23,42,0.08);">
      <div style="background:#0f172a;padding:28px 30px;color:#fff;">
        <div style="font-size:13px;opacity:.72;letter-spacing:.04em;text-transform:uppercase;">TalentMate</div>
        <h1 style="font-size:22px;margin:10px 0 0;line-height:1.35;">${escapeHtml(subject)}</h1>
      </div>
      <div style="padding:28px 30px;color:#1e293b;">
        <p style="font-size:16px;margin:0 0 18px;">${escapeHtml(name)}，你好：</p>
        <div style="font-size:15px;line-height:1.8;white-space:pre-line;">${escapeHtml(body)}</div>
        <div style="margin-top:24px;padding:16px 18px;background:#f8fafc;border-radius:12px;border:1px solid #edf2f7;">
          <div style="font-size:12px;color:#64748b;margin-bottom:5px;">安排事项</div>
          <div style="font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(title)}</div>
          ${startTime ? `<div style="font-size:13px;color:#475569;margin-top:8px;">时间：${escapeHtml(startTime)}</div>` : ''}
        </div>
        <p style="font-size:13px;color:#64748b;margin:24px 0 0;">祝一切顺利。</p>
      </div>
      <div style="background:#f8fafc;padding:14px 30px;color:#94a3b8;font-size:12px;">由 TalentMate 自动生成，可在发送前人工微调。</div>
    </div>
  `;

  return { subject, body, html };
}

function buildCareSubject(eventType, title, name) {
  const map = {
    one_on_one: `${name}，一次 1对1 沟通安排`,
    interview: `${name}，面试安排确认`,
    birthday: `${name}，生日祝福`,
    onboarding: `${name}，入职沟通安排`,
    offer: `${name}，录用沟通安排`,
  };
  return map[eventType] || title;
}

function buildCareBody(eventType, name, title, startTime) {
  const timeText = startTime ? `时间暂定为 ${startTime}。` : '具体时间请以后续日程为准。';
  const map = {
    one_on_one: `想和你做一次轻量的 1对1 沟通，聊聊近期工作状态、协作感受以及需要支持的地方。\n${timeText}`,
    interview: `感谢你对岗位的关注，我们希望和你进一步沟通岗位匹配情况。\n${timeText}`,
    birthday: `今天是一个值得被认真记住的日子。祝你生日快乐，也感谢你一直以来的投入与陪伴。`,
    onboarding: `欢迎加入团队。我们准备了一次入职沟通，帮助你更顺畅地熟悉团队和工作节奏。\n${timeText}`,
    offer: `很高兴与你沟通后续录用安排。我们会在这次沟通中确认关键细节。\n${timeText}`,
  };
  return map[eventType] || `关于「${title}」的安排已创建。\n${timeText}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { sendReminderEmail, renderCareEmail };
