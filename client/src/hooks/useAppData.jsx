/**
 * 应用级共享数据源。
 *
 * 桌面壳（MainLayout）与手机壳（MobileShell）共用同一套状态与请求逻辑，
 * 避免两端各自维护一份导致行为不一致。
 *
 * 数据来源：
 *   GET /api/events                                 —— 当前月（含今天）
 *   GET /api/events?startDate&endDate               —— 今天（首页摘要）
 *   GET /api/contacts                               —— 名册
 *   GET /api/insights/relationship-heatmap          —— 关怀热力图
 */
import React from 'react';
import dayjs from 'dayjs';
import api from '../services/api';

const AppDataContext = React.createContext(null);

/**
 * 计算某个月的查询区间。
 *
 * 后端 GET /api/events 用的是 `start_time >= ? AND start_time <= ?`（闭区间），
 * 所以结束日期必须带上时间后缀，否则 "2026-11-01" 会被当成 00:00:00，
 * 当月最后一天的日程就查不出来。
 * 这里统一：起始 = 当月1日 00:00:00，结束 = 次月1日 00:00:00（排他，避免跨月重复）。
 * 旧实现用 getMonth()+2 拼月份，12 月会得到非法的 "13"，一并修正。
 */
function monthRange(date) {
  const monthStart = dayjs(date).startOf('month');
  const nextMonthStart = monthStart.add(1, 'month');
  return {
    startDate: monthStart.format('YYYY-MM-DD 00:00:00'),
    endDate: nextMonthStart.format('YYYY-MM-DD 00:00:00'),
  };
}

/**
 * 今天的查询区间。
 *
 * 同理，结束必须写成「明天 00:00:00」，只写今天的日期会把今天 00:00 之后的
 * 所有日程都过滤掉（这正是首页「今日安排」一开始查不到数据的原因）。
 */
function todayRange() {
  const start = dayjs().startOf('day');
  const end = start.add(1, 'day');
  return {
    startDate: start.format('YYYY-MM-DD 00:00:00'),
    endDate: end.format('YYYY-MM-DD 00:00:00'),
  };
}

/** 按开始时间升序 */
function sortByStart(list) {
  return [...list].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

export function AppDataProvider({ children }) {
  const [events, setEvents] = React.useState([]);
  const [todayEvents, setTodayEvents] = React.useState([]);
  const [contacts, setContacts] = React.useState([]);
  const [heatmap, setHeatmap] = React.useState([]);
  const [messages, setMessages] = React.useState([]);
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [loading, setLoading] = React.useState(false);

  const username = localStorage.getItem('username') || '用户';

  /** 拉取当前选中月份的日程 */
  const refreshEvents = React.useCallback(async (date) => {
    const target = date || selectedDate;
    const { startDate, endDate } = monthRange(target);
    try {
      const { data } = await api.get('/api/events', { params: { startDate, endDate } });
      if (data.success) setEvents(data.data || []);
      return data.data || [];
    } catch (_) {
      return [];
    }
  }, [selectedDate]);

  /** 仅拉取今天的日程，用于手机首页「今日安排」摘要 */
  const refreshTodayEvents = React.useCallback(async () => {
    const { startDate, endDate } = todayRange();
    try {
      const { data } = await api.get('/api/events', {
        params: { startDate, endDate },
      });
      if (data.success) {
        setTodayEvents(sortByStart(data.data || []));
      }
      return data.data || [];
    } catch (_) {
      return [];
    }
  }, []);

  const refreshContacts = React.useCallback(async () => {
    try {
      const { data } = await api.get('/api/contacts');
      if (data.success) setContacts(data.data || []);
      return data.data || [];
    } catch (_) {
      return [];
    }
  }, []);

  const refreshHeatmap = React.useCallback(async () => {
    try {
      const { data } = await api.get('/api/insights/relationship-heatmap');
      if (data.success) setHeatmap(data.data || []);
      return data.data || [];
    } catch (_) {
      return [];
    }
  }, []);

  /** 一次性刷新全部数据（下拉刷新 / 语音操作后调用） */
  const refreshAll = React.useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        refreshEvents(),
        refreshTodayEvents(),
        refreshContacts(),
        refreshHeatmap(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [refreshEvents, refreshTodayEvents, refreshContacts, refreshHeatmap]);

  // 选中月份变化时重新拉取该月日程
  React.useEffect(() => {
    refreshEvents(selectedDate);
  }, [selectedDate, refreshEvents]);

  // 首次挂载加载名册、热力图与今天日程
  React.useEffect(() => {
    refreshContacts();
    refreshHeatmap();
    refreshTodayEvents();
  }, [refreshContacts, refreshHeatmap, refreshTodayEvents]);

  const value = React.useMemo(() => ({
    // 数据
    events,
    todayEvents,
    contacts,
    heatmap,
    messages,
    selectedDate,
    loading,
    username,
    // setter
    setMessages,
    setSelectedDate,
    setEvents,
    // 刷新
    refreshEvents,
    refreshTodayEvents,
    refreshContacts,
    refreshHeatmap,
    refreshAll,
  }), [
    events, todayEvents, contacts, heatmap, messages, selectedDate, loading, username,
    refreshEvents, refreshTodayEvents, refreshContacts, refreshHeatmap, refreshAll,
  ]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = React.useContext(AppDataContext);
  if (!ctx) {
    throw new Error('useAppData 必须在 <AppDataProvider> 内部使用');
  }
  return ctx;
}

export default AppDataContext;
