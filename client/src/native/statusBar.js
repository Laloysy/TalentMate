/**
 * 状态栏样式。
 *
 * 方案 §12.3：浅色页面使用深色状态栏图标。
 * 本 App 全部页面都是浅灰蓝底 + 白色卡片，因此统一使用深色图标、白色背景，
 * 不启用 overlay（避免内容被状态栏压住，页面顶部安全区已由 mobile.css 处理）。
 */
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative, nativeLog } from './platform';

export async function applyLightStatusBar() {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Light }); // Light 主题 => 深色图标
    await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    nativeLog('status bar error', err?.message);
  }
}

/** 隐藏状态栏（用于全屏语音页等场景，当前暂未使用） */
export async function hideStatusBar() {
  if (!isNative) return;
  try {
    await StatusBar.hide();
  } catch (err) {
    nativeLog('status bar hide error', err?.message);
  }
}
