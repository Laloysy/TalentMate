import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, message } from 'antd';
import MobileHeader from '../../components/MobileHeader';
import { useAppData } from '../../hooks/useAppData';

/**
 * MobileSettingsPage — 手机端设置页。
 *
 * 目前包含账号信息、数据统计与退出登录。
 * 后续可在此扩展通知开关、麦克风权限说明等（方案阶段 4）。
 */
function MobileSettingsPage() {
  const navigate = useNavigate();
  const { username, contacts, events, heatmap } = useAppData();

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
