/**
 * 语音助手结果处理。
 *
 * ChatPanel 只负责录音与上传，把后端返回的原始结果交给这里；
 * 这里统一把结果转成一条助手消息、并同步更新日程/热力图。
 * 桌面端与手机端共用，避免两套逻辑走偏。
 */
import dayjs from 'dayjs';

/**
 * @param {object} result 后端 /api/voice/recognize 的返回
 * @param {object} deps   { setMessages, setEvents, refreshEvents, refreshHeatmap, refreshTodayEvents, setSelectedDate }
 * @returns {object} 归一化后的意图，便于调用方做额外处理
 */
export function applyVoiceResult(result, deps) {
  const {
    setMessages,
    setEvents,
    refreshEvents,
    refreshHeatmap,
    refreshTodayEvents,
    setSelectedDate,
  } = deps;

  const intent = result?.intent;
  const transcript = result?.transcript || '';
  const messageText = result?.message || '';

  const userMsg = { id: Date.now(), type: 'user', text: transcript };
  const assistantMsg = {
    id: Date.now() + 1,
    type: 'assistant',
    text: messageText,
    needsConfirm: result?.needsConfirm || false,
    confirmType: result?.needsConfirm
      ? (intent?.intent === 'modify' ? 'modify' : 'delete')
      : undefined,
    events: result?.events || [],
    modifyPayload: intent?.intent === 'modify' ? intent : null,
    needsContactDisambiguation: result?.needsContactDisambiguation || false,
    contactCandidates: result?.contactCandidates || [],
    pendingIntent: result?.pendingIntent || null,
    contact: result?.contact || null,
  };

  setMessages?.((prev) => [...prev, userMsg, assistantMsg]);

  if (!intent || intent.intent === 'unknown') return intent || {};

  // 新增日程：先乐观插入，保证界面即时反馈，再回源校正
  if (intent.intent === 'add' && intent.events?.length > 0) {
    const sourceEvents = result.events?.length ? result.events : intent.events;
    const pendingIds = [...(result.eventIds || [])];
    const addedEvents = sourceEvents.map((ev) => ({
      id: ev.id || pendingIds.shift?.() || Date.now() + Math.random(),
      title: ev.title,
      start_time: ev.start_time
        || new Date(ev.startTime?.replace(' ', 'T') || Date.now()).toISOString(),
      end_time: ev.end_time
        || (ev.endTime ? new Date(ev.endTime.replace(' ', 'T')).toISOString() : null),
      reminder: ev.reminder || ev.reminderMinutes || 10,
      contact_id: ev.contact_id || result.contact?.id || null,
      contact_name: ev.contact_name || result.contact?.name || null,
      event_type: ev.event_type || intent.eventType || 'general',
      mail_status: ev.mail_status || (result.contact ? 'draft' : 'none'),
    }));
    setEvents?.((prev) => [...prev, ...addedEvents]);
    setTimeout(() => { refreshEvents?.(); refreshHeatmap?.(); refreshTodayEvents?.(); }, 1000);
  }

  // 删除日程：先本地移除
  if (intent.intent === 'delete' && result.deleted) {
    const deletedIds = result.events?.map((e) => e.id) || [];
    setEvents?.((prev) => prev.filter((e) => !deletedIds.includes(e.id)));
    setTimeout(() => { refreshEvents?.(); refreshTodayEvents?.(); }, 500);
  }

  // 修改日程：就地替换
  if (intent.intent === 'modify' && result.modified) {
    const modEvt = result.events?.[0];
    if (modEvt) {
      setEvents?.((prev) => prev.map((e) => (e.id === modEvt.id ? { ...e, ...modEvt } : e)));
      setTimeout(() => { refreshEvents?.(); refreshTodayEvents?.(); }, 500);
    }
  }

  // 查询日程：跳到被查询的日期
  if (intent.intent === 'query' && result.queryDate) {
    setSelectedDate?.(new Date(result.queryDate));
  }

  return intent;
}

/**
 * 手机端根据热力图项拼一句「今天是几号、该关注谁」的问候语。
 */
export function greetingForNow() {
  const hour = dayjs().hour();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}
