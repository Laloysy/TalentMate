import React from 'react';
import {
  DatePicker, Drawer, Form, Input, InputNumber, Select, Button,
  Modal, message, Popconfirm, Calendar, Segmented, Spin,
} from 'antd';
import { PlusOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import MobileHeader from '../../components/MobileHeader';
import { useAppData } from '../../hooks/useAppData';
import { useOverlayBackHandler } from '../../native/overlays';
import { isNative } from '../../native/platform';
import {
  checkNotificationPermission, requestNotificationPermission,
} from '../../native/notifications';
import {
  EVENT_TYPE_OPTIONS, DOT_COLORS, eventTypeMeta,
} from '../HomePage/eventTypes';
import api from '../../services/api';

dayjs.locale('zh-cn');

/**
 * MobileCalendarPage — 手机端日程页。
 *
 * 两种模式：
 *   关怀 —— 按日期分组的列表（手机默认，一屏信息密度更高）
 *   本月 —— 月历，格子里只显示圆点与超出数量，点日期弹出当天 Bottom Sheet
 *
 * 添加/编辑使用全屏 Drawer，日期与时间拆开选择，避免小屏弹出键盘后难以操作。
 */
function MobileCalendarPage() {
  const { events, contacts, selectedDate, setSelectedDate, refreshEvents, refreshTodayEvents, refreshHeatmap } = useAppData();

  const [viewMode, setViewMode] = React.useState('agenda');
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [daySheetDate, setDaySheetDate] = React.useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Android 返回键：先关浮层，再返回上一页
  useOverlayBackHandler(editorOpen, () => setEditorOpen(false));
  useOverlayBackHandler(!!daySheetDate, () => setDaySheetDate(null));

  const current = dayjs(selectedDate);

  // ---- 新增 / 编辑 ----
  const openAdd = (presetDate) => {
    setEditingEvent(null);
    form.resetFields();
    const base = presetDate ? dayjs(presetDate) : dayjs();
    form.setFieldsValue({
      startDate: base,
      startTime: base.format('HH:mm'),
      endDate: base.add(1, 'hour'),
      endTime: base.add(1, 'hour').format('HH:mm'),
      reminder: 10,
      eventType: 'general',
    });
    setEditorOpen(true);
  };

  const openEdit = (ev) => {
    setEditingEvent(ev);
    const start = dayjs(ev.start_time);
    const end = ev.end_time ? dayjs(ev.end_time) : null;
    form.setFieldsValue({
      title: ev.title,
      startDate: start,
      startTime: start.format('HH:mm'),
      endDate: end,
      endTime: end ? end.format('HH:mm') : null,
      reminder: ev.reminder ?? 10,
      contactId: ev.contact_id || undefined,
      eventType: ev.event_type || 'general',
    });
    setEditorOpen(true);
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      setSubmitting(true);
      const start = dayjs(`${v.startDate.format('YYYY-MM-DD')} ${v.startTime}`, 'YYYY-MM-DD HH:mm');
      const end = v.endDate && v.endTime
        ? dayjs(`${v.endDate.format('YYYY-MM-DD')} ${v.endTime}`, 'YYYY-MM-DD HH:mm')
        : null;

      const payload = {
        title: v.title,
        startTime: start.format('YYYY-MM-DD HH:mm'),
        endTime: end ? end.format('YYYY-MM-DD HH:mm') : null,
        reminder: v.reminder ?? 10,
        contactId: v.contactId || null,
        eventType: v.eventType || 'general',
        mailStatus: v.contactId ? 'draft' : 'none',
      };

      if (editingEvent) {
        await api.put(`/api/events/${editingEvent.id}`, payload);
        message.success('已更新');
      } else {
        await api.post('/api/events', payload);
        message.success('已添加');
      }
      setEditorOpen(false);
      refreshEvents();
      refreshTodayEvents();
      refreshHeatmap();

      // 用户刚设置了「提前提醒」，这正是申请通知权限的合适时机：
      // 意图明确、上下文清楚，而不是一启动就弹系统框（方案 §10.10）。
      if (isNative && payload.reminder > 0) {
        const perm = await checkNotificationPermission();
        if (!perm.granted) {
          const asked = await requestNotificationPermission();
          if (asked.granted) {
            message.success('已开启提醒通知');
          }
        }
      }
    } catch (err) {
      if (err?.errorFields) return; // 表单校验失败
      message.error('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/events/${id}`);
      message.success('已删除');
      refreshEvents();
      refreshTodayEvents();
      refreshHeatmap();
    } catch {
      message.error('删除失败');
    }
  };

  // ---- 列表数据：今天及以后，按日期分组 ----
  const grouped = React.useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const map = new Map();
    [...events]
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      .forEach((ev) => {
        const d = dayjs(ev.start_time).format('YYYY-MM-DD');
        if (d < todayStr) return;
        if (!map.has(d)) map.set(d, []);
        map.get(d).push(ev);
      });
    return [...map.entries()].map(([date, list]) => ({
      date,
      isToday: date === todayStr,
      events: list,
    }));
  }, [events]);

  const daySheetEvents = React.useMemo(() => {
    if (!daySheetDate) return [];
    const ds = dayjs(daySheetDate).format('YYYY-MM-DD');
    return events
      .filter((ev) => dayjs(ev.start_time).format('YYYY-MM-DD') === ds)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [events, daySheetDate]);

  /** 月历格子：只画圆点 + 超出数量，不放标题（窄屏放不下） */
  const cellRender = (date) => {
    const ds = typeof date.format === 'function' ? date.format('YYYY-MM-DD') : dayjs(date).format('YYYY-MM-DD');
    const dayEvts = events.filter((ev) => dayjs(ev.start_time).format('YYYY-MM-DD') === ds);
    if (!dayEvts.length) return null;
    return (
      <div className="flex flex-wrap gap-0.5 justify-center pt-0.5">
        {dayEvts.slice(0, 3).map((ev, i) => (
          <span
            key={ev.id}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
          />
        ))}
        {dayEvts.length > 3 && (
          <span className="text-[9px] text-[#1677FF] leading-none">+{dayEvts.length - 3}</span>
        )}
      </div>
    );
  };

  return (
    <>
      <MobileHeader
        title="日程"
        subtitle={`${current.format('YYYY年M月')} · 共 ${events.length} 项`}
        right={(
          <button
            type="button"
            onClick={() => openAdd()}
            aria-label="添加日程"
            className="mobile-touch w-11 h-11 flex items-center justify-center rounded-full
              bg-[#1677FF] text-white border-0 cursor-pointer active:opacity-80"
          >
            <PlusOutlined />
          </button>
        )}
      />

      <div className="px-4 pt-2">
        {/* 模式切换 + 月份切换 */}
        <div className="flex items-center justify-between mb-2">
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: '关怀', value: 'agenda' },
              { label: '本月', value: 'month' },
            ]}
            className="!rounded-full"
          />
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="上个月"
              onClick={() => setSelectedDate(current.subtract(1, 'month').toDate())}
              className="mobile-touch w-11 h-11 flex items-center justify-center rounded-full
                text-slate-500 border-0 bg-transparent cursor-pointer active:bg-slate-100"
            >
              <LeftOutlined className="text-xs" />
            </button>
            <button
              type="button"
              aria-label="下个月"
              onClick={() => setSelectedDate(current.add(1, 'month').toDate())}
              className="mobile-touch w-11 h-11 flex items-center justify-center rounded-full
                text-slate-500 border-0 bg-transparent cursor-pointer active:bg-slate-100"
            >
              <RightOutlined className="text-xs" />
            </button>
          </div>
        </div>
      </div>

      {/* 关怀列表 */}
      {viewMode === 'agenda' && (
        <div className="px-4 pb-4">
          {grouped.length === 0 ? (
            <EmptyBlock text="暂无关怀安排" hint="点右上角 ＋ 或右下角麦克风安排一次沟通" />
          ) : (
            grouped.map((group) => (
              <section key={group.date} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold ${group.isToday ? 'text-red-400' : 'text-slate-500'}`}>
                    {group.isToday ? '● 今天 · ' : ''}{dayjs(group.date).format('M月D日 dddd')}
                  </span>
                  <span className="flex-1 h-px bg-slate-200/70" />
                </div>
                <div className="space-y-2">
                  {group.events.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      onEdit={() => openEdit(ev)}
                      onDelete={() => handleDelete(ev.id)}
                      onMail={() => navigate(`/mail/${ev.id}`)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {/* 月历 */}
      {viewMode === 'month' && (
        <div className="px-2 pb-2">
          <div className="mobile-calendar bg-white rounded-2xl shadow-sm border border-white overflow-hidden">
            <Calendar
              value={current}
              onSelect={(d) => setDaySheetDate(d.toDate())}
              onChange={(d) => setSelectedDate(d.toDate())}
              cellRender={cellRender}
              fullscreen
              headerRender={() => null}
            />
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            点击日期查看当天安排
          </p>
        </div>
      )}

      {/* 当天详情 Bottom Sheet */}
      <Drawer
        placement="bottom"
        open={!!daySheetDate}
        onClose={() => setDaySheetDate(null)}
        height="auto"
        className="mobile-sheet"
        styles={{ body: { padding: '0 16px calc(16px + var(--safe-bottom))' } }}
        closable={false}
      >
        <div className="pt-1">
          <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-800">
              {daySheetDate ? dayjs(daySheetDate).format('M月D日 dddd') : ''}
            </h3>
            <button
              type="button"
              onClick={() => setDaySheetDate(null)}
              aria-label="关闭"
              className="mobile-touch w-11 h-11 flex items-center justify-center rounded-full
                text-slate-400 border-0 bg-transparent cursor-pointer active:bg-slate-100"
            >
              ✕
            </button>
          </div>

          {daySheetEvents.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">这天还没有安排</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {daySheetEvents.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  compact
                  onEdit={() => { setDaySheetDate(null); openEdit(ev); }}
                  onDelete={() => handleDelete(ev.id)}
                  onMail={() => setMailPreview({ open: true, event: ev, contact: findContact(ev) })}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => { const d = daySheetDate; setDaySheetDate(null); openAdd(d); }}
            className="w-full mt-3 py-3 border border-dashed border-slate-200 rounded-xl
              text-sm text-slate-500 bg-transparent cursor-pointer active:bg-slate-50
              flex items-center justify-center gap-2"
          >
            <PlusOutlined /> 添加关怀安排
          </button>
        </div>
      </Drawer>

      {/* 全屏编辑 Drawer */}
      <Drawer
        placement="right"
        width="100%"
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <MobileHeader
          title={editingEvent ? '编辑关怀安排' : '添加关怀安排'}
          onBack={() => setEditorOpen(false)}
          right={(
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="px-3 h-11 rounded-lg bg-[#1677FF] text-white text-sm font-medium
                border-0 cursor-pointer disabled:opacity-60"
            >
              {submitting ? '保存中' : '保存'}
            </button>
          )}
        />

        <div className="mobile-content px-4">
          <Form form={form} layout="vertical" className="pt-2">
            <Form.Item name="title" label="事项标题" rules={[{ required: true, message: '请输入标题' }]}>
              <Input placeholder="例如：和张伟1对1" size="large" />
            </Form.Item>

            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="startDate" label="开始日期" rules={[{ required: true, message: '请选择日期' }]}>
                <DatePicker className="!w-full" size="large" inputReadOnly />
              </Form.Item>
              <Form.Item name="startTime" label="开始时间" rules={[{ required: true, message: '请选择时间' }]}>
                <TimeField />
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="endDate" label="结束日期">
                <DatePicker className="!w-full" size="large" inputReadOnly />
              </Form.Item>
              <Form.Item name="endTime" label="结束时间">
                <TimeField />
              </Form.Item>
            </div>

            <Form.Item name="contactId" label="关联联系人">
              <Select
                allowClear
                showSearch
                size="large"
                placeholder="选择名册中的员工或候选人"
                optionFilterProp="label"
                options={contacts.map((c) => ({
                  value: c.id,
                  label: `${c.name}${c.department ? ` / ${c.department}` : ''}`,
                }))}
              />
            </Form.Item>

            <Form.Item name="eventType" label="关怀类型">
              <Select options={EVENT_TYPE_OPTIONS} size="large" />
            </Form.Item>

            <Form.Item name="reminder" label="提前提醒（分钟）">
              <InputNumber min={0} max={1440} className="!w-full" size="large" placeholder="默认 10 分钟" />
            </Form.Item>
          </Form>
        </div>
      </Drawer>
    </>
  );
}

/**
 * 时间选择：使用 DatePicker 的 time 选择器。
 * 不依赖 dayjs 的 customParseFormat 插件（项目未安装），
 * 表单里存的是 "HH:mm" 字符串，提交时再与日期拼接。
 */
function TimeField({ value, onChange }) {
  return (
    <DatePicker
      picker="time"
      format="HH:mm"
      minuteStep={5}
      className="!w-full"
      size="large"
      inputReadOnly
      value={value ? dayjs(`2000-01-01 ${value}`, 'YYYY-MM-DD HH:mm') : null}
      onChange={(d) => onChange?.(d ? d.format('HH:mm') : null)}
    />
  );
}

/** 日程卡片：编辑/删除/邮件都做成常显按钮，不依赖 hover */
function EventCard({ event, onEdit, onDelete, onMail, compact }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const meta = eventTypeMeta(event.event_type);
  const start = dayjs(event.start_time).format('HH:mm');
  const end = event.end_time ? dayjs(event.end_time).format('HH:mm') : null;

  return (
    <div
      className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
      style={{ borderLeft: `4px solid ${meta.color}` }}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${meta.bg} ${meta.text}`}>
                {meta.label}
              </span>
              {event.mail_status && event.mail_status !== 'none' && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-500">
                  {event.mail_status === 'sent' ? '邮件已发' : '邮件草稿'}
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-slate-800 mt-1.5">{event.title}</h4>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              {start}{end && ` – ${end}`}
              {event.reminder > 0 && <span className="ml-2 font-sans">⏰ 提前{event.reminder}分钟</span>}
            </p>
            {event.contact_name && (
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                <span
                  className="w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center shrink-0"
                  style={{ background: event.contact_avatar_color || '#1677FF' }}
                >
                  {(event.contact_name || '?').slice(-1)}
                </span>
                {event.contact_name}
              </p>
            )}
          </div>

          {/* 常显的操作菜单，不依赖 hover */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="更多操作"
              className="mobile-touch w-11 h-11 flex items-center justify-center rounded-full
                text-slate-400 border-0 bg-transparent cursor-pointer active:bg-slate-100"
            >
              ⋮
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-50 w-32 bg-white rounded-xl shadow-lg
                  border border-slate-100 py-1 overflow-hidden">
                  <MenuItem onClick={() => { setMenuOpen(false); onEdit(); }}>编辑</MenuItem>
                  {event.contact_id && (
                    <MenuItem onClick={() => { setMenuOpen(false); onMail(); }}>邮件草稿</MenuItem>
                  )}
                  <Popconfirm
                    title="确认删除？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => { setMenuOpen(false); onDelete(); }}
                  >
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-sm text-red-500
                        border-0 bg-transparent cursor-pointer active:bg-red-50"
                    >
                      删除
                    </button>
                  </Popconfirm>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 text-sm text-slate-700
        border-0 bg-transparent cursor-pointer active:bg-slate-50"
    >
      {children}
    </button>
  );
}

function EmptyBlock({ text, hint }) {
  return (
    <div className="py-14 text-center">
      <div className="text-4xl mb-3">📭</div>
      <p className="text-sm text-slate-500">{text}</p>
      {hint && <p className="text-xs text-slate-400 mt-2">{hint}</p>}
    </div>
  );
}

export default MobileCalendarPage;
