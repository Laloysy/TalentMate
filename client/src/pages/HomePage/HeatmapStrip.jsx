import React from 'react';
import { Modal, Tooltip } from 'antd';

const STATUS_STYLE = {
  healthy: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-red-50 text-red-700 border-red-100',
  new: 'bg-slate-50 text-slate-600 border-slate-100',
};

const STATUS_LABEL = {
  danger: '高优先级',
  warning: '需关注',
  scheduled: '已安排',
  new: '新联系人',
  healthy: '正常',
};

const PRIORITY = {
  danger: 0,
  warning: 1,
  scheduled: 2,
  new: 3,
  healthy: 4,
};

function HeatmapStrip({ items = [], onSelect }) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const p = (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9);
      if (p !== 0) return p;
      return (b.days_since_interaction ?? -1) - (a.days_since_interaction ?? -1);
    });
  }, [items]);

  const summary = React.useMemo(() => ({
    danger: items.filter((item) => item.status === 'danger').length,
    warning: items.filter((item) => item.status === 'warning').length,
    scheduled: items.filter((item) => item.status === 'scheduled').length,
  }), [items]);

  if (!items.length) {
    return (
      <div className="px-5 py-3 border-b border-gray-100 text-xs text-slate-400">
        名册为空，添加联系人后会生成关怀热力图
      </div>
    );
  }

  return (
    <div className="px-5 py-3 border-b border-gray-100">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-slate-500 shrink-0">关怀热力图</span>
          <StatusPill label="高优先级" value={summary.danger} tone="danger" />
          <StatusPill label="需关注" value={summary.warning} tone="warning" />
          <StatusPill label="已安排" value={summary.scheduled} tone="scheduled" />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <div className="hidden md:flex items-center gap-1.5 min-w-0">
            {sortedItems.slice(0, 6).map((item) => (
              <ContactDot key={item.id} item={item} onSelect={onSelect} />
            ))}
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="h-8 px-3 rounded-full border border-slate-100 bg-slate-50 text-xs text-slate-500 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
          >
            查看全部 {items.length}
          </button>
        </div>
      </div>

      <Modal
        title="关怀热力图总览"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={760}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
          {sortedItems.map((item) => {
            const style = STATUS_STYLE[item.status] || STATUS_STYLE.new;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setModalOpen(false);
                  onSelect?.(item);
                }}
                className="text-left border border-slate-100 rounded-xl p-3 hover:border-blue-100 hover:bg-blue-50/30 transition cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-9 h-9 rounded-full text-white text-sm flex items-center justify-center font-semibold shrink-0"
                    style={{ background: item.avatar_color || '#1677FF' }}
                  >
                    {(item.name || '?').slice(-1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 truncate">{item.name}</span>
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] ${style}`}>
                        {STATUS_LABEL[item.status] || '未知'}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-400 mt-1 truncate">
                      {item.department || item.role || item.email || '未填写更多信息'}
                    </span>
                    <span className="block text-xs text-slate-500 mt-2">{item.reason}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

function StatusPill({ label, value, tone }) {
  const style = STATUS_STYLE[tone] || STATUS_STYLE.new;
  return (
    <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] ${style}`}>
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function ContactDot({ item, onSelect }) {
  const style = STATUS_STYLE[item.status] || STATUS_STYLE.new;
  return (
    <Tooltip title={`${item.name}：${item.reason}`}>
      <button
        onClick={() => onSelect?.(item)}
        className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer hover:shadow-sm ${style}`}
      >
        <span
          className="w-6 h-6 rounded-full text-white text-[11px] flex items-center justify-center font-semibold"
          style={{ background: item.avatar_color || '#1677FF' }}
        >
          {(item.name || '?').slice(-1)}
        </span>
      </button>
    </Tooltip>
  );
}

export default HeatmapStrip;
