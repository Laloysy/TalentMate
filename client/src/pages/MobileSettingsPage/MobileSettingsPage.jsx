import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, message, Switch } from 'antd';
import MobileHeader from '../../components/MobileHeader';
import { useAppData } from '../../hooks/useAppData';
import { isNative } from '../../native/platform';
import {
  checkNotificationPermission, requestNotificationPermission,
  syncEventNotifications,
} from '../../native/notifications';

/**
 * MobileSettingsPage — 手机端设置页。
 *
 * 目前包含账号信息、提醒通知开关、数据统计与退出登录。
 */
function MobileSettingsPage() {
  const navigate = useNavigate();
  const { username, contacts, events, heatmap } = useAppData();
  const [reminderOn, setReminderOn] = React.useState(false);
  const [permBusy, setPermBusy] = React.useState(false);

  // 读取当前通知权限，避免开关状态与实际权限不一致
  React.useEffect(() => {
    if (!isNative) return;
    checkNotificationPermission().then((p) => setReminderOn(p.granted));
  }, []);

  /** 打开提醒：此时才申请通知权限（方案 §10.10 要求按需申请） */
  const enableReminders = async () => {
    setPermBusy(true);
    try {
      const result = await requestNotificationPermission();
      if (result.granted) {
        setReminderOn(true);
        // 授权后立刻按现有日程重建一次提醒（内部会按 7 天窗口过滤）
        await syncEventNotifications(events);
        message.success('已开启日程提醒');
      } else {
        message.warning('未获得通知权限，请在系统设置中开启');
      }
    } finally {
      setPermBusy(false);
    }
  };

  const disableReminders = async () => {
    // 关闭只清空本 App 已排期通知；系统级权限需要用户在系统设置里撤销
    await syncEventNotifications([]);
    setReminderOn(false);
    message.success('已清除已排期的提醒');
  };

  const confirmLogout = () => {
    Modal.confirm({
      title: '确认退出登录？',
      okText: '退出',
      cancelText: '取消',
      onOk: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('has_seen_tour');
        message.success('已退出登录');
        navigate('/login', { replace: true });
      },
    });
  };

  return (
    <>
      <MobileHeader title="设置" onBack={() => navigate('/')} />

      <div className="px-4 pt-3 space-y-3">
        {/* 账号 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-white">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">账号</h2>
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full bg-slate-900 text-white font-bold
              flex items-center justify-center">
              {(username || '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{username}</p>
              <p className="text-xs text-slate-400 mt-0.5">TalentMate 伴贤</p>
            </div>
          </div>
        </section>

        {/* 提醒通知 */}
        {isNative && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-white">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-800">日程提醒</h2>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {reminderOn
                    ? '将在日程开始前按「提前提醒」分钟数通知你'
                    : '开启后会在日程开始前推送本地通知'}
                </p>
              </div>
              <Switch
                checked={reminderOn}
                loading={permBusy}
                onChange={(checked) => (checked ? enableReminders() : disableReminders())}
              />
            </div>
          </section>
        )}

        {/* 数据概览 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-white">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">数据概览</h2>
          <Row label="联系人" value={`${contacts.length} 人`} />
          <Row label="本月日程" value={`${events.length} 项`} />
          <Row label="关怀分析" value={`${heatmap.length} 条`} last />
        </section>

        {/* 关于 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-white">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">关于</h2>
          <Row label="应用名称" value="TalentMate 伴贤" />
          <Row label="版本" value="1.0 (Debug)" />
          <Row label="包名" value="com.talentmate.app" last />
        </section>

        {/* 退出登录 */}
        <button
          type="button"
          onClick={confirmLogout}
          className="w-full min-h-[48px] rounded-2xl bg-white border border-red-100
            text-red-500 text-sm font-medium cursor-pointer active:bg-red-50 shadow-sm"
        >
          退出登录
        </button>
      </div>
    </>
  );
}

function Row({ label, value, last }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${last ? '' : 'border-b border-slate-50'}`}>
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-700 font-medium">{value}</span>
    </div>
  );
}

export default MobileSettingsPage;
