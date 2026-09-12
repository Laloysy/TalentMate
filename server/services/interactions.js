async function logInteraction(pool, { userId, contactId = null, eventId = null, actionType, title, detail = null, occurredAt = null }) {
  await pool.query(
    `INSERT INTO interaction_logs (user_id, contact_id, event_id, action_type, title, detail, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, contactId, eventId, actionType, title, detail, occurredAt || formatDateTime(new Date())]
  );
}

function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

module.exports = { logInteraction };
