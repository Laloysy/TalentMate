import React from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Tour, Segmented } from 'antd';
import CalendarPanel from './CalendarPanel';
import ChatPanel from './ChatPanel';
import DirectoryPanel from './DirectoryPanel';
import TimelinePanel from './TimelinePanel';
import api from '../../services/api';

/**
 * MainLayout — responsive dual-panel per PRD §4.4.
 * Left: calendar (60–65%), Right: AI chat (35–40%).
 */
function MainLayout() {
  const navigate = useNavigate();
  const [events, setEvents] = React.useState([]);
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [messages, setMessages] = React.useState([]);
  const [viewMode, setViewMode] = React.useState('month');
  const [workspaceMode, setWorkspaceMode] = React.useState('calendar');
  const [contacts, setContacts] = React.useState([]);
  const [heatmap, setHeatmap] = React.useState([]);
  const [selectedContact, setSelectedContact] = React.useState(null);
  const [isTourOpen, setIsTourOpen] = React.useState(false);

  // Tour refs
  const calendarRef = React.useRef(null);
  const micRef = React.useRef(null);

  const username = localStorage.getItem('username') || '用户';

  // Tour auto-trigger on first visit
  React.useEffect(() => {
    const seen = localStorage.getItem('has_seen_tour') === '1';
    if (!seen) setTimeout(() => setIsTourOpen(true), 800);
  }, []);

  const handleVoiceResult = (result) => {
    const intent = result.intent;
    const userMsg = { id: Date.now(), type: 'user', text: result.transcript };
    const assistantMsg = {
      id: Date.now() + 1,
      type: 'assistant',
      text: result.message,
      needsConfirm: result.needsConfirm || false,
      confirmType: result.needsConfirm ? (intent?.intent === 'modify' ? 'modify' : 'delete') : undefined,
      events: result.events || [],
      modifyPayload: intent?.intent === 'modify' ? intent : null,
      needsContactDisambiguation: result.needsContactDisambiguation || false,
      contactCandidates: result.contactCandidates || [],
      pendingIntent: result.pendingIntent || null,
      contact: result.contact || null,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    if (!intent || intent.intent === 'unknown') return;

    // Immediately add events for instant UI feedback
    if (intent.intent === 'add' && intent.events?.length > 0) {
      const sourceEvents = result.events?.length ? result.events : intent.events;
      const addedEvents = sourceEvents.map((ev) => ({
        id: ev.id || result.eventIds?.shift?.() || Date.now() + Math.random(),
        title: ev.title,
        start_time: ev.start_time || new Date(ev.startTime?.replace(' ', 'T') || Date.now()).toISOString(),
        end_time: ev.end_time || (ev.endTime ? new Date(ev.endTime.replace(' ', 'T')).toISOString() : null),
        reminder: ev.reminder || ev.reminderMinutes || 10,
        contact_id: ev.contact_id || result.contact?.id || null,
        contact_name: ev.contact_name || result.contact?.name || null,
        event_type: ev.event_type || intent.eventType || 'general',
        mail_status: ev.mail_status || (result.contact ? 'draft' : 'none'),
      }));
      console.log('[Voice] Adding events to calendar:', addedEvents);
      setEvents((prev) => [...prev, ...addedEvents]);
      setTimeout(() => refreshEvents(), 1000);
      setTimeout(() => refreshHeatmap(), 1000);
    }

    if (intent.intent === 'delete' && result.deleted) {
      const deletedIds = result.events?.map(e => e.id) || [];
      setEvents((prev) => prev.filter(e => !deletedIds.includes(e.id)));
      setTimeout(() => refreshEvents(), 500);
    }

    if (intent.intent === 'modify' && result.modified) {
      const modEvt = result.events?.[0];
      if (modEvt) {
        setEvents((prev) => prev.map(e => e.id === modEvt.id ? { ...e, ...modEvt } : e));
        setTimeout(() => refreshEvents(), 500);
      }
    }

    if (intent.intent === 'query' && result.queryDate) {
      // Auto-jump calendar to queried date
      setSelectedDate(new Date(result.queryDate));
    }
  };

  // Direct refresh without useCallback closure issues
  const refreshEvents = async () => {
    try {
      const d = new Date(selectedDate);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const nextM = String(d.getMonth() + 2).padStart(2, '0');
      const start = `${y}-${m}-01`;
      const end = `${y}-${nextM}-01`;
      console.log('[refreshEvents] Fetching', start, '~', end);
      const { data } = await api.get('/api/events', { params: { startDate: start, endDate: end } });
      console.log('[refreshEvents] Got', data.data?.length, 'events');
      if (data.success) setEvents(data.data);
    } catch (_) {}
  };

  const refreshContacts = async () => {
    try {
      const { data } = await api.get('/api/contacts');
      if (data.success) setContacts(data.data || []);
    } catch (_) {}
  };

  const refreshHeatmap = async () => {
    try {
      const { data } = await api.get('/api/insights/relationship-heatmap');
      if (data.success) setHeatmap(data.data || []);
    } catch (_) {}
  };

  // Load events on mount and when selectedDate changes
  React.useEffect(() => { refreshEvents(); }, [selectedDate]);
  React.useEffect(() => { refreshContacts(); refreshHeatmap(); }, []);

  const openTimeline = (contact) => {
    setSelectedContact(contact);
    setWorkspaceMode('timeline');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    message.success('已退出登录');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#EEF3F8] p-4 md:p-5 lg:p-6">
      <div className="max-w-[1500px] mx-auto h-[calc(100vh-2rem)] md:h-[calc(100vh-2.5rem)] lg:h-[calc(100vh-3rem)] flex flex-col gap-4">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">TM</span>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 leading-tight">TalentMate 伴贤</h1>
              <p className="text-xs text-slate-500 mt-0.5">语音驱动的职场关系关怀工作台</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
            <span className="px-3 py-1.5 rounded-full bg-white border border-slate-100">名册 {contacts.length}</span>
            <span className="px-3 py-1.5 rounded-full bg-white border border-slate-100">关怀日程 {events.length}</span>
          </div>
        </div>

        {/* Responsive dual-panel */}
        <div className="flex flex-col lg:flex-row gap-5 min-h-0 flex-1">
        {/* Left: Calendar Panel */}
        <div ref={calendarRef} className="w-full lg:w-[60%] xl:w-[65%] flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-white/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <Segmented
              value={workspaceMode}
              onChange={setWorkspaceMode}
              options={[
                { label: '日历', value: 'calendar' },
                { label: '名册', value: 'directory' },
                { label: '时间线', value: 'timeline' },
              ]}
              className="!rounded-full"
            />
            <span className="text-xs text-slate-400">关系管理视图</span>
          </div>
          <div className="flex-1 min-h-0">
            {workspaceMode === 'calendar' && (
              <CalendarPanel
                events={events}
                contacts={contacts}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onRefresh={() => { refreshEvents(); refreshHeatmap(); }}
                heatmap={heatmap}
                onSelectContact={openTimeline}
              />
            )}
            {workspaceMode === 'directory' && (
              <DirectoryPanel
                contacts={contacts}
                heatmap={heatmap}
                onRefresh={() => { refreshContacts(); refreshHeatmap(); }}
                onSelect={openTimeline}
              />
            )}
            {workspaceMode === 'timeline' && <TimelinePanel contact={selectedContact} />}
          </div>
        </div>

        {/* Right: Chat Panel */}
        <div className="w-full lg:w-[40%] xl:w-[35%] lg:min-w-[380px] lg:max-w-[450px] flex flex-col bg-white rounded-2xl shadow-sm border border-white/80 h-full">
          <ChatPanel
            messages={messages}
            onVoiceResult={handleVoiceResult}
            username={username}
            onLogout={handleLogout}
            onRefresh={refreshEvents}
            onContactsRefresh={() => { refreshContacts(); refreshHeatmap(); }}
            micRef={micRef}
          />
        </div>
        </div>
      </div>

      {/* Ant Design Tour — guided onboarding */}
      <Tour
        open={isTourOpen}
        onClose={async () => {
          setIsTourOpen(false);
          localStorage.setItem('has_seen_tour', '1');
          try { await api.put('/api/auth/complete-tour'); } catch (_) {}
        }}
        steps={[
          {
            title: '关系关怀看板',
            description: '左侧统一管理日历、名册、个人互动时间线和关怀热力图。',
            target: () => calendarRef.current,
          },
          {
            title: '用语音安排关怀',
            description: '点击麦克风，直接说：「明天下午三点安排和张伟的一对一沟通」。',
            target: () => micRef.current,
          },
        ]}
      />
    </div>
  );
}

export default MainLayout;
