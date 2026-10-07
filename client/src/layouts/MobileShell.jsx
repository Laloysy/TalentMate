import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import VoiceFab from '../components/VoiceFab';
import '../styles/mobile.css';

/**
 * 这些页面不显示语音悬浮按钮：
 *   /calendar  —— 顶栏已有 ＋ 新增入口，且月历需要完整高度
 *   /assistant —— 页面本身就是语音助手（内含更大的麦克风按钮），
 *                 再叠一个 FAB 会出现两个互相抢焦点的录音入口
 */
const HIDE_FAB_ON = ['/calendar', '/assistant'];

/**
 * MobileShell — 手机端外壳。
 *
 * 结构：底部导航（固定） + 语音悬浮按钮 + 内容区（由各页面自行渲染顶栏）。
 *
 * 说明：顶栏没有放在 Shell 里统一定制，是因为各页面标题与右侧操作不同，
 * 而且二级页面需要返回按钮；因此由各页面使用 <MobileHeader> 自行声明。
 * 这里只负责固定的底部导航、悬浮按钮与安全区留白。
 */
function MobileShell() {
  const { pathname } = useLocation();
  const showFab = !HIDE_FAB_ON.some((p) => pathname.startsWith(p));

  return (
    <div className="mobile-shell min-h-[100dvh] bg-[#EEF3F8]">
      <main className={`mobile-content min-h-[100dvh] ${showFab ? '' : 'no-fab'}`}>
        <Outlet />
      </main>
      {showFab && <VoiceFab />}
      <MobileBottomNav />
    </div>
  );
}

export default MobileShell;
