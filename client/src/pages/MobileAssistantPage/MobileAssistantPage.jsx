import React from 'react';
import { useNavigate } from 'react-router-dom';
import MobileHeader from '../../components/MobileHeader';
import ChatPanel from '../HomePage/ChatPanel';
import { useAppData } from '../../hooks/useAppData';
import { applyVoiceResult } from '../../hooks/useVoiceAssistant';

/**
 * MobileAssistantPage — 手机端语音助手全屏页。
 *
 * 复用桌面端 ChatPanel 的录音、上传、意图确认与邮件预览逻辑，
 * 只把外壳换成整屏页面（由底部中央的 VoiceFab 进入），
 * 避免为移动端重写一遍语音闭环。
 */
function MobileAssistantPage() {
  const navigate = useNavigate();

  // 注意：不要解构 refreshEvents，它的 useCallback 依赖 selectedDate。
  // 这里只取状态 setter，让 applyVoiceResult 内部的延迟刷新调用最新的 refreshEvents。
  const app = useAppData();
  const {
    messages, setMessages, setEvents, contacts,
    refreshContacts, refreshHeatmap, refreshTodayEvents, setSelectedDate,
  } = app;

  const handleVoiceResult = React.useCallback((result) => {
    applyVoiceResult(result, {
      setMessages,
      setEvents,
      // 用 app.* 形式访问，始终拿到最新闭包中的函数
      refreshEvents: () => app.refreshEvents(),
      refreshHeatmap,
      refreshTodayEvents,
      setSelectedDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, setMessages, setEvents, refreshHeatmap, refreshTodayEvents, setSelectedDate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('has_seen_tour');
    navigate('/login', { replace: true });
  };

  return (
    <>
      <MobileHeader
        title="关怀助手"
        subtitle="说一句话，自动安排日程与邮件草稿"
        onBack={() => navigate('/')}
      />

      <div className="px-2 pt-2">
        <div className="bg-white rounded-2xl shadow-sm border border-white overflow-hidden
          h-[calc(100dvh-var(--mobile-header-h)-var(--safe-top)-var(--mobile-nav-h)-var(--safe-bottom)-24px)]">
          <ChatPanel
            messages={messages}
            onVoiceResult={handleVoiceResult}
            username={app.username}
            onLogout={handleLogout}
            onRefresh={() => { app.refreshEvents(); refreshTodayEvents(); }}
            onContactsRefresh={() => { refreshContacts(); refreshHeatmap(); }}
          />
        </div>

        {contacts.length === 0 && (
          <p className="text-[11px] text-slate-400 text-center mt-3 px-4">
            名册为空时语音只能创建无关联的日程，建议先添加联系人
          </p>
        )}
      </div>
    </>
  );
}

export default MobileAssistantPage;
