/**
 * 关怀热力图状态常量。
 * 数据来自 GET /api/insights/relationship-heatmap，每项至少包含：
 *   { id, name, status, reason, days_since_interaction, avatar_color, department, role, email }
 */

export const HEATMAP_STATUS_STYLE = {
  healthy: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-red-50 text-red-700 border-red-100',
  new: 'bg-slate-50 text-slate-600 border-slate-100',
};

export const HEATMAP_STATUS_LABEL = {
  danger: '高优先级',
  warning: '需关注',
  scheduled: '已安排',
  new: '新联系人',
  healthy: '正常',
};

/** 排序优先级：越紧急越靠前 */
export const HEATMAP_PRIORITY = {
  danger: 0,
  warning: 1,
  scheduled: 2,
  new: 3,
  healthy: 4,
};

export function heatmapStyle(status) {
  return HEATMAP_STATUS_STYLE[status] || HEATMAP_STATUS_STYLE.new;
}

export function heatmapLabel(status) {
  return HEATMAP_STATUS_LABEL[status] || '未知';
}

/** 按紧急度 + 未沟通天数排序，返回新数组 */
export function sortHeatmap(items = []) {
  return [...items].sort((a, b) => {
    const p = (HEATMAP_PRIORITY[a.status] ?? 9) - (HEATMAP_PRIORITY[b.status] ?? 9);
    if (p !== 0) return p;
    return (b.days_since_interaction ?? -1) - (a.days_since_interaction ?? -1);
  });
}

/** 统计各状态数量 */
export function summarizeHeatmap(items = []) {
  const count = (status) => items.filter((item) => item.status === status).length;
  return {
    danger: count('danger'),
    warning: count('warning'),
    scheduled: count('scheduled'),
    new: count('new'),
    healthy: count('healthy'),
    /** 高优先级 + 需关注 */
    attention: count('danger') + count('warning'),
  };
}
