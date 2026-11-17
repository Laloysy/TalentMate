/**
 * 「日程提醒」用户偏好的持久化。
 *
 * BUG-004：设置页的开关此前只把状态放在组件 state 里，重新进入页面时又从
 * 系统通知权限重新推导（权限仍然是「已授予」），于是「关闭提醒 → 退出页面 →
 * 再进入」开关自己又恢复成开启，用户无法确认关闭是否生效。
 *
 * 现在把「用户是否想要提醒」单独持久化：
 *   - 开关状态 = 用户偏好（本模块） && 系统权限（仅在需要真正推送时校验）
 *   - 关闭时写入 "0"，即使系统权限还在，也不应再排期通知
 *
 * 默认开启：老版本用户没有这个键，保持原有的提醒行为。
 */
const KEY = 'tm_reminder_enabled';

/** 用户是否开启了日程提醒（默认开启） */
export function isReminderEnabled() {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch (err) {
    // 隐私模式 / 存储被禁用时按开启处理，不影响主流程
    return true;
  }
}

/** 记录用户对日程提醒的意愿 */
export function setReminderEnabled(enabled) {
  try {
    localStorage.setItem(KEY, enabled ? '1' : '0');
  } catch (err) {
    /* 忽略写入失败：开关仍会在本次会话内生效 */
  }
}

/** 退出登录时清除该偏好，避免串账号 */
export function clearReminderPreference() {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    /* 忽略 */
  }
}

export default { isReminderEnabled, setReminderEnabled, clearReminderPreference };
