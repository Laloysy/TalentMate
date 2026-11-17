/**
 * 把日程同步为 Android 本地通知。
 *
 * 同步时机（方案 §13）：
 *   - 登录后首次加载
 *   - 日程数据发生变化（新增 / 修改 / 删除都会反映到 events 上）
 *   - App 从后台回到前台
 *
 * 退出登录时清除所有通知。
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { isNative, nativeLog } from '../native/platform';
import {
  syncEventNotifications, cancelAllNotifications, registerNotificationTapHandler,
} from '../native/notifications';
import { isReminderEnabled } from '../native/reminderPref';
import { registerAppState } from '../native/appLifecycle';

/** 取未来 N 天的日程，用于计算通知 */
async function fetchUpcomingEvents(days = 7) {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00:00`;

  const { data } = await api.get('/api/events', {
    params: { startDate: fmt(start), endDate: fmt(end) },
  });
  return data?.success ? (data.data || []) : [];
}

/**
 * @param {Array} events AppData 中当前月份的日程，作为「数据已变化」的信号
 */
export function useNotificationSync(events) {
  const navigate = useNavigate();

  // 点击通知 → 跳到日程页（带上 eventId 供后续高亮）
  React.useEffect(() => {
    if (!isNative) return undefined;
    let dispose = () => {};
    registerNotificationTapHandler((eventId) => {
      nativeLog('open event from notification', eventId);
      navigate(eventId ? `/calendar?eventId=${eventId}` : '/calendar');
    }).then((fn) => { dispose = fn; });
    return () => dispose();
  }, [navigate]);

  // 数据变化 / 登录后同步
  React.useEffect(() => {
    if (!isNative) return;
    if (!localStorage.getItem('token')) {
      cancelAllNotifications();
      return;
    }

    // BUG-004：用户在设置里关闭提醒后，任何数据变化或回到前台都不应再把通知排上。
    // 以前这里无条件同步，所以"关闭提醒"撑不过一次页面切换。
    if (!isReminderEnabled()) {
      cancelAllNotifications();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const upcoming = await fetchUpcomingEvents();
        if (cancelled) return;
        await syncEventNotifications(upcoming);
      } catch (err) {
        nativeLog('notification sync failed', err?.message);
      }
    })();

    return () => { cancelled = true; };
    // events 引用变化即代表数据变化；用长度+首尾 id 做轻量指纹，避免无谓重排
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // 回到前台时重新同步
  React.useEffect(() => {
    if (!isNative) return undefined;
    let dispose = () => {};
    registerAppState((isActive) => {
      if (!isActive) return;
      if (!localStorage.getItem('token')) return;
      if (!isReminderEnabled()) {
        cancelAllNotifications();
        return;
      }
      fetchUpcomingEvents()
        .then((upcoming) => syncEventNotifications(upcoming))
        .catch((err) => nativeLog('resume sync failed', err?.message));
    }).then((fn) => { dispose = fn; });
    return () => dispose();
  }, []);
}

/** 退出登录时清除通知（供设置页与各退出入口调用） */
export async function clearNotificationsOnLogout() {
  await cancelAllNotifications();
}

export default useNotificationSync;
