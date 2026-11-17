import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Drawer, Form, Input, Select, DatePicker, Spin, message, Popconfirm, Tag,
} from 'antd';
import dayjs from 'dayjs';
import MobileHeader from '../../components/MobileHeader';
import { useAppData } from '../../hooks/useAppData';
import { heatmapLabel, heatmapStyle } from '../HomePage/heatmap';
import { useOverlayBackHandler } from '../../native/overlays';
import api from '../../services/api';

const CONTACT_TYPES = [
  { value: 'employee', label: '员工' },
  { value: 'candidate', label: '候选人' },
];

const TIMELINE_LABEL = {
  event_created: '日程',
  event_updated: '更新',
  event_cancelled: '已取消',
  mail_draft: '邮件草稿',
  mail_sent: '邮件已发',
  one_on_one: '1对1',
  interview: '面试',
  birthday: '生日',
  onboarding: '入职',
  offer: '录用',
  followup: '跟进',
};

/**
 * MobileContactDetailPage — 联系人详情 + 互动时间线。
 *
 * 编辑与删除都收敛到这一页（名册列表只负责浏览），删除带二次确认。
 */
function MobileContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { contacts, heatmap, refreshContacts, refreshHeatmap, refreshEvents, refreshTodayEvents } = useAppData();

  const [timeline, setTimeline] = React.useState(null);
  const [loadingTimeline, setLoadingTimeline] = React.useState(true);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [form] = Form.useForm();
  // 同步提交锁，避免连续点击重复提交（与名册新增同样的问题）
  const submitLockRef = React.useRef(false);

  // Android 返回键：先关浮层
  useOverlayBackHandler(editorOpen, () => setEditorOpen(false));

  const contactId = Number(id);
  const contact = React.useMemo(
    () => contacts.find((c) => c.id === contactId),
    [contacts, contactId],
  );
  const heat = React.useMemo(
    () => heatmap.find((h) => h.id === contactId),
    [heatmap, contactId],
  );

  React.useEffect(() => {
    if (!contactId) return;
    setLoadingTimeline(true);
    api.get(`/api/contacts/${contactId}/timeline`)
      .then((resp) => setTimeline(resp.data.data))
      .catch(() => setTimeline(null))
      .finally(() => setLoadingTimeline(false));
  }, [contactId]);

  const merged = React.useMemo(() => {
    const logs = timeline?.logs || [];
    const evts = timeline?.events || [];
    return [
      ...logs.map((l) => ({ ...l, source: 'log' })),
      ...evts.map((e) => ({
        ...e,
        source: 'event',
        action_type: e.event_type || 'event',
        detail: e.mail_status,
        occurred_at: e.occurred_at || e.start_time,
      })),
    ].sort((a, b) => new Date(String(b.occurred_at).replace(' ', 'T'))
      - new Date(String(a.occurred_at).replace(' ', 'T')));
  }, [timeline]);

  const openEdit = () => {
    if (!contact) return;
    form.setFieldsValue({
      name: contact.name,
      email: contact.email,
      contactType: contact.contact_type,
      department: contact.department,
      role: contact.role,
      birthday: contact.birthday ? dayjs(contact.birthday) : null,
      onboardDate: contact.onboard_date ? dayjs(contact.onboard_date) : null,
      avatarColor: contact.avatar_color,
      notes: contact.notes,
    });
    setEditorOpen(true);
  };

  const submit = async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    try {
      const v = await form.validateFields();
      setSubmitting(true);
      await api.put(`/api/contacts/${contactId}`, {
        ...v,
        birthday: v.birthday ? v.birthday.format('YYYY-MM-DD') : null,
        onboardDate: v.onboardDate ? v.onboardDate.format('YYYY-MM-DD') : null,
      });
      message.success('已更新');
      setEditorOpen(false);
      refreshContacts();
      refreshHeatmap();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || '保存失败，请重试');
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/api/contacts/${contactId}`);
      message.success('已删除');
      refreshContacts();
      refreshHeatmap();
      // BUG-008：服务端删除联系人时会把 events.contact_id 置空，
      // 但前端此前只刷新名册与热力图，日程/首页仍显示旧联系人姓名，
      // 要等重启 App 才会消失。这里同步刷新日程与今日摘要。
      refreshEvents();
      refreshTodayEvents();
      navigate('/contacts', { replace: true });
    } catch {
      message.error('删除失败');
    }
  };

  if (!contact) {
    return (
      <>
        <MobileHeader title="联系人" onBack={() => navigate('/contacts')} />
        <div className="py-20 flex justify-center"><Spin /></div>
      </>
    );
  }

  return (
    <>
      <MobileHeader
        title={contact.name}
        subtitle={[contact.department, contact.role].filter(Boolean).join(' · ') || undefined}
        onBack={() => navigate('/contacts')}
        right={(
          <Popconfirm
            title="确认删除该联系人？"
            description="相关日程与互动记录也会被移除。"
            okText="删除"
            cancelText="取消"
            onConfirm={remove}
          >
            <button
              type="button"
              aria-label="删除联系人"
              className="mobile-touch w-11 h-11 flex items-center justify-center rounded-full
                text-red-400 border-0 bg-transparent cursor-pointer active:bg-red-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M19 7l-.9 12.1A2 2 0 0116.1 21H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" />
              </svg>
            </button>
          </Popconfirm>
        )}
      />

      <div className="px-4 pt-3 space-y-3">
        {/* 资料卡 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-white">
          <div className="flex items-center gap-3">
            <span
              className="w-14 h-14 rounded-full text-white text-xl font-semibold flex items-center justify-center shrink-0"
              style={{ background: contact.avatar_color || '#1677FF' }}
            >
              {(contact.name || '?').slice(-1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 truncate">{contact.name}</h2>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] shrink-0">
                  {contact.contact_type === 'candidate' ? '候选人' : '员工'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {[contact.department, contact.role].filter(Boolean).join(' · ') || '未填写部门与岗位'}
              </p>
              {contact.email && <p className="text-xs text-slate-500 mt-1 truncate">{contact.email}</p>}
            </div>
          </div>

          {/* 三个主操作 */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <ActionButton label="安排沟通" primary onClick={() => navigate(`/calendar?action=new&contactId=${contactId}`)} />
            <ActionButton label="编辑资料" onClick={openEdit} />
            <ActionButton label="写邮件" onClick={() => navigate(`/mail/new?contactId=${contactId}&from=contact`)} disabled={!contact.email && !contact.id} />
          </div>
        </section>

        {/* 关系状态 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-white">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">关系状态</h3>
          {heat ? (
            <>
              <span className={`inline-block px-2.5 py-1 rounded-full border text-xs ${heatmapStyle(heat.status)}`}>
                {heatmapLabel(heat.status)}
                {heat.days_since_interaction != null && heat.status !== 'new'
                  ? ` · ${heat.days_since_interaction} 天未沟通` : ''}
              </span>
              {heat.reason && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{heat.reason}</p>}
            </>
          ) : (
            <p className="text-xs text-slate-400">暂无关系数据</p>
          )}

          {(contact.birthday || contact.onboard_date) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {contact.birthday && (
                <Tag className="!m-0 !text-xs">生日 {dayjs(contact.birthday).format('M月D日')}</Tag>
              )}
              {contact.onboard_date && (
                <Tag className="!m-0 !text-xs">入职 {dayjs(contact.onboard_date).format('YYYY年M月D日')}</Tag>
              )}
            </div>
          )}
          {contact.notes && (
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">{contact.notes}</p>
          )}
        </section>

        {/* 互动时间线 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-white">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">互动时间线</h3>
          {loadingTimeline ? (
            <div className="py-8 flex justify-center"><Spin size="small" /></div>
          ) : merged.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">暂无互动记录</p>
          ) : (
            <div className="relative pl-5">
              <span className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-slate-100" />
              {merged.map((item, idx) => (
                <div key={`${item.source}-${item.id}-${idx}`} className="relative pb-4">
                  <span className="absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#1677FF] ring-4 ring-blue-50" />
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-slate-800 min-w-0 flex-1">{item.title}</h4>
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] shrink-0">
                      {TIMELINE_LABEL[item.action_type] || '互动'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {dayjs(item.occurred_at).format('YYYY年M月D日 HH:mm')}
                  </p>
                  {item.detail && (
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{item.detail}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 编辑资料 */}
      <Drawer
        placement="right"
        width="100%"
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <MobileHeader
          title="编辑资料"
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
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '邮箱格式不正确' },
              ]}
            >
              <Input size="large" />
            </Form.Item>
            <Form.Item name="contactType" label="类型">
              <Select options={CONTACT_TYPES} size="large" />
            </Form.Item>
            <Form.Item name="department" label="部门"><Input size="large" /></Form.Item>
            <Form.Item name="role" label="岗位"><Input size="large" /></Form.Item>
            <Form.Item name="birthday" label="生日">
              <DatePicker className="!w-full" size="large" inputReadOnly />
            </Form.Item>
            <Form.Item name="onboardDate" label="入职日期">
              <DatePicker className="!w-full" size="large" inputReadOnly />
            </Form.Item>
            <Form.Item name="avatarColor" label="头像颜色"><Input size="large" /></Form.Item>
            <Form.Item name="notes" label="备注"><Input.TextArea rows={3} /></Form.Item>
          </Form>
        </div>
      </Drawer>
    </>
  );
}

function ActionButton({ label, onClick, primary, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] rounded-xl text-xs font-medium border cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${primary
          ? 'bg-[#1677FF] text-white border-[#1677FF]'
          : 'bg-slate-50 text-slate-600 border-slate-100'}`}
    >
      {label}
    </button>
  );
}

export default MobileContactDetailPage;
