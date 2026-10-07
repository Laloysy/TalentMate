/**
 * 关怀日程类型常量。
 * 桌面端（CalendarPanel）与手机端（MobileCalendarPage 等）共用，避免字典重复维护。
 */

export const EVENT_TYPE_OPTIONS = [
  { value: 'general', label: '普通日程' },
  { value: 'one_on_one', label: '1对1沟通' },
  { value: 'interview', label: '面试跟进' },
  { value: 'birthday', label: '生日关怀' },
  { value: 'onboarding', label: '入职/周年' },
  { value: 'offer', label: '录用确认' },
  { value: 'followup', label: '候选人跟进' },
];

/** 每种类型的主色、浅底与文字色，用于卡片左侧色条与标签 */
export const EVENT_TYPE_META = {
  general: { label: '普通日程', color: '#64748B', bg: 'bg-slate-50', text: 'text-slate-600' },
  one_on_one: { label: '1对1', color: '#1677FF', bg: 'bg-blue-50', text: 'text-blue-600' },
  interview: { label: '面试', color: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-600' },
  birthday: { label: '生日', color: '#EC4899', bg: 'bg-pink-50', text: 'text-pink-600' },
  onboarding: { label: '入职', color: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  offer: { label: '录用', color: '#8B5CF6', bg: 'bg-violet-50', text: 'text-violet-600' },
  followup: { label: '跟进', color: '#EF4444', bg: 'bg-red-50', text: 'text-red-600' },
};

/** 月历格子里事件圆点/左侧色条的颜色序列 */
export const DOT_COLORS = ['#1677FF', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#EC4899'];

export function eventTypeMeta(type) {
  return EVENT_TYPE_META[type] || EVENT_TYPE_META.general;
}

export function labelForEventType(type) {
  const found = EVENT_TYPE_OPTIONS.find((item) => item.value === type);
  return found?.label || '普通日程';
}
