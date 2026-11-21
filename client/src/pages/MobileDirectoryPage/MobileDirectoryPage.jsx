import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Drawer, Form, Input, InputNumber, Select, DatePicker, Button, message, Popconfirm, Modal,
} from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import MobileHeader from '../../components/MobileHeader';
import { useAppData } from '../../hooks/useAppData';
import { heatmapLabel, heatmapStyle, CARE_LEVEL_OPTIONS, careLevelLabel, careLevelStyle } from '../HomePage/heatmap';
import { useOverlayBackHandler } from '../../native/overlays';
import api from '../../services/api';

const CONTACT_TYPES = [
  { value: 'employee', label: '员工' },
  { value: 'candidate', label: '候选人' },
];

/**
 * MobileDirectoryPage — 手机端名册页。
 *
 * 固定单列列表；搜索与筛选适配窄屏；点击进入联系人详情。
 * 编辑/删除移到详情页，这里只负责浏览、搜索、新增与 CSV 粘贴导入。
 */
function MobileDirectoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { contacts, heatmap, refreshContacts, refreshHeatmap } = useAppData();

  const [keyword, setKeyword] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [csvOpen, setCsvOpen] = React.useState(false);
  const [csv, setCsv] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [form] = Form.useForm();
  // 同步提交锁：双击时两次点击都会在 setState 生效前进入 handler，
  // 只用 disabled 属性挡不住，所以再加一个 ref（BUG-007）。
  const submitLockRef = React.useRef(false);

  // Android 返回键：先关浮层
  useOverlayBackHandler(editorOpen, () => setEditorOpen(false));
  useOverlayBackHandler(csvOpen, () => setCsvOpen(false));

  // 支持从首页「添加联系人」快捷入口直接打开编辑面板
  React.useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openAdd();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heatmapById = React.useMemo(() => {
    const map = new Map();
    heatmap.forEach((item) => map.set(item.id, item));
    return map;
  }, [heatmap]);

  const filtered = React.useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return contacts.filter((c) => {
      const matchType = typeFilter === 'all' || c.contact_type === typeFilter;
      const text = [c.name, c.email, c.department, c.role].filter(Boolean).join(' ').toLowerCase();
      return matchType && (!q || text.includes(q));
    });
  }, [contacts, keyword, typeFilter]);

  const stats = React.useMemo(() => ({
    total: contacts.length,
    attention: heatmap.filter((h) => h.status === 'warning' || h.status === 'danger').length,
    scheduled: heatmap.filter((h) => h.status === 'scheduled').length,
  }), [contacts, heatmap]);

  function openAdd() {
    form.resetFields();
    form.setFieldsValue({ contactType: 'employee', avatarColor: '#1677FF', careLevel: 'normal' });
    setEditorOpen(true);
  }

  const submit = async () => {
    if (submitLockRef.current) return; // 双击 / 连点直接忽略第二次
    submitLockRef.current = true;
    try {
      const v = await form.validateFields();
      setSubmitting(true);
      await api.post('/api/contacts', {
        ...v,
        birthday: v.birthday ? v.birthday.format('YYYY-MM-DD') : null,
        onboardDate: v.onboardDate ? v.onboardDate.format('YYYY-MM-DD') : null,
      });
      message.success('已添加');
      setEditorOpen(false);
      refreshContacts();
      refreshHeatmap();
    } catch (err) {
      if (err?.errorFields) return;
      // 服务端对重复邮箱返回 409 和明确的提示语，直接透出给用户
      message.error(err?.response?.data?.message || '保存失败，请重试');
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const importCsv = async () => {
    if (!csv.trim()) {
      message.warning('请先粘贴 CSV 内容');
      return;
    }
    try {
      setSubmitting(true);
      const { data } = await api.post('/api/contacts/import-csv', { csv });
      message.success(data.message || '导入完成');
      setCsvOpen(false);
      setCsv('');
      refreshContacts();
      refreshHeatmap();
    } catch {
      message.error('导入失败，请检查 CSV 格式');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <MobileHeader
        title="人才名册"
        subtitle={`联系人 ${stats.total} · 待关注 ${stats.attention} · 已安排 ${stats.scheduled}`}
        right={(
          <button
            type="button"
            onClick={openAdd}
            aria-label="添加联系人"
            className="mobile-touch w-11 h-11 flex items-center justify-center rounded-full
              bg-[#1677FF] text-white border-0 cursor-pointer active:opacity-80"
          >
            <PlusOutlined />
          </button>
        )}
      />

      <div className="px-4 pt-3">
        {/* 搜索 */}
        <Input
          allowClear
          size="large"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索姓名、邮箱、部门或岗位"
          prefix={<SearchOutlined className="text-slate-300" />}
          className="!rounded-xl"
        />

        {/* 类型筛选 */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
          {[{ value: 'all', label: '全部' }, ...CONTACT_TYPES].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTypeFilter(t.value)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-xs border cursor-pointer min-h-[36px]
                ${typeFilter === t.value
                  ? 'bg-[#1677FF] text-white border-[#1677FF]'
                  : 'bg-white text-slate-500 border-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCsvOpen(true)}
            className="shrink-0 px-3.5 py-2 rounded-full text-xs min-h-[36px]
              bg-white text-slate-500 border border-slate-200 cursor-pointer"
          >
            粘贴 CSV
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="px-4 pt-3 pb-4">
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-sm text-slate-500">
              {contacts.length === 0 ? '名册还是空的' : '没有匹配的联系人'}
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="mt-4 px-4 py-2.5 rounded-xl bg-[#1677FF] text-white text-sm
                border-0 cursor-pointer"
            >
              添加第一位联系人
            </button>
          </div>
        ) : (
          <ul className="space-y-2 list-none p-0 m-0">
            {filtered.map((c) => {
              const h = heatmapById.get(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/contacts/${c.id}`)}
                    className="w-full text-left bg-white rounded-xl border border-slate-100
                      shadow-sm p-3 flex items-center gap-3 cursor-pointer active:bg-slate-50"
                  >
                    <span
                      className="w-10 h-10 rounded-full text-white font-semibold flex items-center justify-center shrink-0"
                      style={{ background: c.avatar_color || '#1677FF' }}
                    >
                      {(c.name || '?').slice(-1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">{c.name}</span>
                        {c.contact_type === 'candidate' && (
                          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] shrink-0">
                            候选人
                          </span>
                        )}
                        {c.care_level === 'high' && (
                          <span className={`px-1.5 py-0.5 rounded-full border text-[10px] shrink-0 ${careLevelStyle('high')}`}>
                            {careLevelLabel('high')}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-slate-400 truncate mt-0.5">
                        {[c.department, c.role].filter(Boolean).join(' · ') || c.email || '未填写更多信息'}
                      </span>
                      {/* 状态同时给出文字，不只依赖颜色 */}
                      {h && (
                        <span className={`inline-block mt-1.5 px-1.5 py-0.5 rounded-full border text-[10px] ${heatmapStyle(h.status)}`}>
                          {heatmapLabel(h.status)}
                          {h.days_since_interaction != null && h.status !== 'new'
                            ? ` · ${h.days_since_interaction} 天未沟通` : ''}
                        </span>
                      )}
                    </span>
                    <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 新增联系人 */}
      <Drawer
        placement="right"
        width="100%"
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <MobileHeader
          title="添加联系人"
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
              <Input size="large" placeholder="例如：张伟" />
            </Form.Item>
            {/* BUG-006：邮箱是服务端必填项，这里必须给出必填标识与格式校验，
                否则用户会误判邮箱可选，提交后才被服务端拒绝 */}
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '邮箱格式不正确' },
              ]}
            >
              <Input size="large" placeholder="name@example.com" />
            </Form.Item>
            <Form.Item name="contactType" label="类型">
              <Select options={CONTACT_TYPES} size="large" />
            </Form.Item>
            {/* 人工指定关注等级：重点联系人的提醒阈值更低，会更早进入「需关注」 */}
            <Form.Item
              name="careLevel"
              label="关注等级"
              extra="重点联系人阈值更低：同样天数会比普通员工更早进入需关注"
            >
              <Select options={CARE_LEVEL_OPTIONS} size="large" />
            </Form.Item>
            {/* 自定义阈值：留空则用上面的等级预设 */}
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="careWarnDays" label="需关注天数" extra="留空用预设">
                <InputNumber min={1} max={365} className="!w-full" size="large" placeholder="如 21" />
              </Form.Item>
              <Form.Item name="careDangerDays" label="高优先级天数" extra="需大于上一个">
                <InputNumber min={1} max={365} className="!w-full" size="large" placeholder="如 35" />
              </Form.Item>
            </div>
            <Form.Item name="department" label="部门">
              <Input size="large" />
            </Form.Item>
            <Form.Item name="role" label="岗位">
              <Input size="large" />
            </Form.Item>
            <Form.Item name="birthday" label="生日">
              <DatePicker className="!w-full" size="large" inputReadOnly />
            </Form.Item>
            <Form.Item name="onboardDate" label="入职日期">
              <DatePicker className="!w-full" size="large" inputReadOnly />
            </Form.Item>
            <Form.Item name="avatarColor" label="头像颜色">
              <Input size="large" placeholder="#1677FF" />
            </Form.Item>
            <Form.Item name="notes" label="备注">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Form>
        </div>
      </Drawer>

      {/* CSV 粘贴导入 */}
      <Modal
        title="粘贴 CSV 导入"
        open={csvOpen}
        onCancel={() => setCsvOpen(false)}
        onOk={importCsv}
        confirmLoading={submitting}
        okText="导入"
        cancelText="取消"
        className="mobile-sheet"
      >
        <p className="text-xs text-slate-400 mb-2">
          第一行为表头，需包含 name，可选 email、department、role、contact_type。
        </p>
        <Input.TextArea
          rows={8}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={'name,email,department,role\n张伟,zhang@example.com,研发部,产品经理'}
        />
      </Modal>
    </>
  );
}

export default MobileDirectoryPage;
