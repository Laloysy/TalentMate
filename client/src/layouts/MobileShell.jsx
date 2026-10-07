import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import VoiceFab from '../components/VoiceFab';
import { useAppData } from '../hooks/useAppData';
import { useNotificationSync } from '../hooks/useNotificationSync';
import { isNative } from '../native/platform';
import { applyLightStatusBar } from '../native/statusBar';
import { registerBackButton } from '../native/appLifecycle';
import { closeTopOverlay } from '../native/overlays';
import '../styles/mobile.css';

/**
 * 这些页面不显示语音悬浮按钮：
 *   /calendar  —— 顶栏已有 ＋ 新增入口，且月历需要完整高度
 *   /assistant —— 页面本身就是语音助手（内含更大的麦克风按钮），
 *                 再叠一个 FAB 会出现两个互相抢焦点的录音入口
 */
const HIDE_FAB_ON = ['/calendar', '/assistant'];

/**
 * 返回键的路由层级。
 * 一级 Tab 彼此之间按「切回首页」处理，二级页面上再按一次才退出。
 */
const TAB_PATHS = ['/calendar', '/contacts', '/insights'];

/**
 * MobileShell — 手机端外壳。
 *
 * 职责：
 *   - 固定底部导航 + 语音悬浮按钮 + 安全区留白
 *   - 状态栏样式、Android 返回键、本地通知同步（仅原生环境）
 *
 * 顶栏由各页面自行渲染，因为标题与右侧操作不同，二级页面还需要返回按钮。
 */
function MobileShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { events } = useAppData();

  const showFab = !HIDE_FAB_ON.some((p) => pathname.startsWith(p));

  // 仅原生环境：状态栏样式
  React.useEffect(() => {
    if (isNative) applyLightStatusBar();
  }, []);

  // 仅原生环境：把日程同步为本地通知（登录后 / 数据变化 / 回到前台）
  useNotificationSync(events);

  // 仅原生环境：Android 返回键
  React.useEffect(() => {
    if (!isNative) return undefined;
    let dispose = () => {};
    registerBackButton({
      // 1) 先尝试关闭已打开的浮层
      onOverlay: () => closeTopOverlay(),
      // 2/3) 再处理路由层级
      onNavigate: () => {
        // 二级页面（联系人详情、设置）→ 返回所属 Tab
        if (pathname.startsWith('/contacts/')) {
          navigate('/contacts');
          return true;
        }
        if (pathname === '/settings') {
          navigate('/');
          return true;
        }
        if (pathname === '/assistant') {
          navigate('/');
          return true;
        }
        // 在非首页的一级 Tab → 切回首页
        if (TAB_PATHS.some((p) => pathname.startsWith(p))) {
          navigate('/');
          return true;
        }
        // 已在首页且无浮层 → 返回 false，由 appLifecycle 退出 App
        return false;
      },
    }).then((fn) => { dispose = fn; });
    return () => dispose();
  }, [navigate, pathname]);

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
