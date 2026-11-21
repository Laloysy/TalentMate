import React from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, DatePicker, message, Empty, Tag } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import { CARE_LEVEL_OPTIONS, careLevelLabel, careLevelStyle } from './heatmap';

const STATUS_META = {
  scheduled: { label: '已安排', className: 'bg-blue-50 text-blue-700 border-blue-100' },
  healthy: { label: '正常', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  warning: { label: '需关注', className: 'bg-amber-50 text-amber-700 border-amber-100' },
  danger: { label: '高优先级', className: 'bg-red-50 text-red-700 border-red-100' },
  new: { label: '新联系人', className: 'bg-slate-50 text-slate-600 border-slate-100' },
};

function DirectoryPanel({ contacts = [], heatmap = [], onRefresh, onSelect }) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [csvOpen, setCsvOpen] = React.useState(false);
  const [csv, setCsv] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [form] = Form.useForm();

  const heatmapById = React.useMemo(() => {
    const map = new Map();
    heatmap.forEach((item) => map.set(item.id, item));
    return map;
  }, [heatmap]);

  const filteredContacts = React.useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchType = typeFilter === 'all' || contact.contact_type === typeFilter;
      const text = [contact.name, contact.email, contact.department, contact.role].filter(Boolean).join(' ').toLowerCase();
      return matchType && (!q || text.includes(q));
    });
  }, [contacts, keyword, typeFilter]);

  const stats = React.useMemo(() => {
    const candidateCount = contacts.filter((item) => item.contact_type === 'candidate').length;
    const riskyCount = heatmap.filter((item) => item.status === 'warning' || item.status === 'danger').length;
    const scheduledCount = heatmap.filter((item) => item.status === 'scheduled').length;
    return { candidateCount, riskyCount, scheduledCount };
  }, [contacts, heatmap]);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ contactType: 'employee', avatarColor: '#1677FF', careLevel: 'normal' });
    setModalOpen(true);
  };

  const openEdit = (contact) => {
    setEditing(contact);
    form.setFieldsValue({
      name: contact.name,
      email: contact.email,
      contactType: contact.contact_type,
      department: contact.department,
      role: contact.role,
      birthday: contact.birthday ? dayjs(contact.birthday) : null,
      onboardDate: contact.onboard_date ? dayjs(contact.onboard_date) : null,
      avatarColor: contact.avatar_color,
      careLevel: contact.care_level || 'normal',
      careWarnDays: contact.care_warn_days ?? null,
      careDangerDays: contact.care_danger_days ?? null,
      notes: contact.notes,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : null,
        onboardDate: values.onboardDate ? values.onboardDate.format('YYYY-MM-DD') : null,
      };
      if (editing) await api.put(`/api/contacts/${editing.id}`, payload);
      else await api.post('/api/contacts', payload);
      message.success(editing ? '联系人已更新' : '联系人已添加');
      setModalOpen(false);
      onRefresh?.();
    } catch (err) {
      if (!err.errorFields) message.error('保存失败');
    }
  };

  const remove = async (contact) => {
    try {
      await api.delete(`/api/contacts/${contact.id}`);
      message.success('联系人已删除');
      onRefresh?.();
    } catch {
      message.error('删除失败');
    }
  };

  const importCsv = async () => {
    try {
      const { data } = await api.post('/api/contacts/import-csv', { csv });
      message.success(data.message || '导入完成');
      setCsvOpen(false);
      setCsv('');
      onRefresh?.();
    } catch {
      message.error('导入失败，请检查 CSV 格式');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-semibold text-slate-800">人才名册</h2>
          <p className="text-xs text-slate-400 mt-0.5">维护员工与候选人，持续追踪每段关系的温度</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="small" icon={<UploadOutlined />} onClick={() => setCsvOpen(true)}>导入</Button>
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openAdd}>添加</Button>
        </div>
      </div>

      <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/40">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Metric label="联系人" value={contacts.length} />
          <Metric label="待关注" value={stats.riskyCount} tone={stats.riskyCount > 0 ? 'warn' : 'normal'} />
          <Metric label="已安排" value={stats.scheduledCount} tone="blue" />
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            prefix={<SearchOutlined className="text-slate-300" />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索姓名、邮箱、部门或岗位"
          />
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            className="md:!w-36"
            options={[
              { value: 'all', label: '全部类型' },
              { value: 'employee', label: '员工' },
              { value: 'candidate', label: '候选人' },
            ]}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {contacts.length === 0 ? (
          <Empty description="暂无联系人" />
        ) : filteredContacts.length === 0 ? (
          <Empty description="没有匹配的联系人" />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {filteredContacts.map((contact) => {
              const status = heatmapById.get(contact.id);
              const meta = STATUS_META[status?.status || 'new'];
              return (
              <button
                key={contact.id}
                onClick={() => onSelect?.(contact)}
                className="text-left bg-white border border-slate-100 rounded-xl p-4 hover:border-blue-100 hover:shadow-sm transition cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className="w-11 h-11 rounded-xl text-white flex items-center justify-center font-semibold shrink-0"
                      style={{ background: contact.avatar_color || '#1677FF' }}
                    >
                      {(contact.name || '?').slice(-1)}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-800 truncate">{contact.name}</span>
                      <span className="block text-xs text-slate-500 mt-1 truncate">
                        {contact.department || contact.role || '未填写部门/岗位'}
                      </span>
                      <span className="block text-xs text-slate-400 mt-1 truncate">{contact.email || '未填写邮箱'}</span>
                    </span>
                  </div>
                  <span className="flex gap-1">
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEdit(contact); }} />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); remove(contact); }} />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <Tag color={contact.contact_type === 'candidate' ? 'orange' : 'blue'} className="!m-0">
                      {contact.contact_type === 'candidate' ? '候选人' : '员工'}
                    </Tag>
                    {contact.care_level === 'high' && (
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] ${careLevelStyle('high')}`}>
                        {careLevelLabel('high')}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 truncate">{status?.reason || '尚未记录互动'}</span>
                </div>
              </button>
              );
            })}
          </div>
        )}
      </div>

      <Modal title={editing ? '编辑联系人' : '添加联系人'} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input /></Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}
          >
            <Input placeholder="用于发送关怀邮件" />
          </Form.Item>
          <Form.Item name="contactType" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={[{ value: 'employee', label: '员工' }, { value: 'candidate', label: '候选人' }]} />
          </Form.Item>
          <Form.Item
            name="careLevel"
            label="关注等级"
            extra="重点联系人阈值更低：同样天数会比普通员工更早进入「需关注」"
          >
            <Select options={CARE_LEVEL_OPTIONS} />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="careWarnDays" label="需关注天数" extra="留空用预设">
              <InputNumber min={1} max={365} className="!w-full" placeholder="如 21" />
            </Form.Item>
            <Form.Item name="careDangerDays" label="高优先级天数" extra="需大于上一个">
              <InputNumber min={1} max={365} className="!w-full" placeholder="如 35" />
            </Form.Item>
          </div>
          <Form.Item name="department" label="部门"><Input /></Form.Item>
          <Form.Item name="role" label="岗位 / 职位"><Input /></Form.Item>
          <Form.Item name="birthday" label="生日"><DatePicker className="!w-full" /></Form.Item>
          <Form.Item name="onboardDate" label="入职时间"><DatePicker className="!w-full" /></Form.Item>
          <Form.Item name="avatarColor" label="头像颜色"><Input type="color" /></Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="导入 CSV" open={csvOpen} onOk={importCsv} onCancel={() => setCsvOpen(false)} okText="导入" cancelText="取消">
        <p className="text-xs text-slate-500 mb-2">必填表头：姓名,邮箱,类型。可选：部门,岗位,生日,入职时间,备注</p>
        <Input.TextArea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="姓名,邮箱,类型,部门,岗位&#10;小张,zhang@example.com,employee,研发部,前端工程师" />
      </Modal>
    </div>
  );
}

function Metric({ label, value, tone = 'normal' }) {
  const toneClass = tone === 'warn' ? 'text-amber-600' : tone === 'blue' ? 'text-blue-600' : 'text-slate-800';
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3 py-2">
      <div className={`text-lg font-semibold leading-tight ${toneClass}`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

export default DirectoryPanel;
