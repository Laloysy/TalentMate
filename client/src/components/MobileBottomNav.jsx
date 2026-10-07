import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * MobileBottomNav — 手机端底部一级导航。
 *
 * 四个 Tab：首页 / 日程 / 名册 / 洞察。
 * 语音助手不占 Tab，由底部中央悬浮按钮（VoiceFab）打开。
 */
const TABS = [
  {
    key: 'home',
    path: '/',
    label: '首页',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 10.5L12 3l9 7.5M5.5 9.5V20h13V9.5" />
    ),
  },
  {
    key: 'calendar',
    path: '/calendar',
    label: '日程',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M7 3v3m10-3v3M4 8.5h16M5 5.5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1v-13a1 1 0 011-1z" />
    ),
  },
  {
    key: 'directory',
    path: '/contacts',
    label: '名册',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M16 19v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 17.5V19m13-9.5a3 3 0 11-6 0 3 3 0 016 0zM8.5 9.5a2.75 2.75 0 11-5.5 0 2.75 2.75 0 015.5 0z" />
    ),
  },
  {
    key: 'insights',
    path: '/insights',
    label: '洞察',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 19V9m5 10V5m5 14v-7m5 7V8" />
    ),
  },
];

function MobileBottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  /** 一级 Tab 采用「前缀匹配」，二级页面下仍高亮所属 Tab */
  const isActive = (path) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  return (
    <nav
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-30
        bg-white/95 backdrop-blur-md border-t border-slate-100
        flex items-stretch px-1"
    >
      {TABS.map((tab) => {
        const active = isActive(tab.path);
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 border-0 bg-transparent
              cursor-pointer transition-colors ${active ? 'text-[#1677FF]' : 'text-slate-400'}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {tab.icon}
            </svg>
            <span className={`text-[11px] ${active ? 'font-semibold' : ''}`}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default MobileBottomNav;
