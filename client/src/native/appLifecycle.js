/**
 * Android 返回键与 App 生命周期。
 *
 * 返回键规则（方案 §12.4）：
 *   1. 有打开的 Modal / Bottom Sheet / Drawer → 先关闭
 *   2. 否则如果在二级页面 → 返回上一页
 *   3. 否则如果不是首页 → 切回首页
 *   4. 否则 → 再按一次退出
 *
 * 「有打开的浮层」由各页面通过 registerBackHandler 自行注册，Shell 负责按顺序询问。
 */
import { App } from '@capacitor/app';
import { isNative, nativeLog } from './platform';

/** 已注册的浮层关闭器，后注册的优先（符合「最后打开的浮层先关」直觉） */
const backHandlers = new Set();

/**
 * 注册一个「关闭浮层」处理器。
 * @param {() => boolean} handler 返回 true 表示已消费本次返回键
 * @returns 注销函数
 */
export function registerBackHandler(handler) {
  backHandlers.add(handler);
  return () => backHandlers.delete(handler);
}

/** 依次询问已注册的浮层处理器，返回 true 表示本次返回键已被消费 */
function consumeByOverlay() {
  const list = [...backHandlers].reverse();
  for (const handler of list) {
    try {
      if (handler()) return true;
    } catch (err) {
      nativeLog('back handler error', err?.message);
    }
  }
  return false;
}

/**
 * 监听硬件返回键。
 * @param {object} opts
 * @param {() => boolean} opts.onOverlay 关闭浮层（由 Shell 传入，内部会带上已注册的处理器）
 * @param {() => boolean} opts.onNavigate 处理路由层级的返回，返回 true 表示已消费
 * @returns 取消监听的函数
 */
export async function registerBackButton({ onOverlay, onNavigate }) {
  if (!isNative) return () => {};
  try {
    const handle = await App.addListener('backButton', () => {
      // 1) 浮层优先（Shell 自己的浮层 + 页面注册的处理器）
      if (onOverlay?.()) return;
      if (consumeByOverlay()) return;

      // 2/3) 交给路由层级判断
      if (onNavigate?.()) return;

      // 4) 已在首页且无浮层 → 退出 App
      nativeLog('back at root, exiting app');
      App.exitApp();
    });
    return () => handle.remove();
  } catch (err) {
    nativeLog('register back button error', err?.message);
    return () => {};
  }
}

/**
 * 监听 App 回到前台。
 * 用于回到前台时重新同步本地通知，以及触发数据刷新。
 * @param {(isActive:boolean) => void} onChange
 */
export async function registerAppState(onChange) {
  if (!isNative) return () => {};
  try {
    const handle = await App.addListener('appStateChange', ({ isActive }) => {
      nativeLog('appStateChange isActive=', isActive);
      onChange?.(isActive);
    });
    return () => handle.remove();
  } catch (err) {
    nativeLog('register app state error', err?.message);
    return () => {};
  }
}

/**
 * 处理 Android 深链/打开链接（点击通知等场景由插件分别处理，
 * 这里兜底处理系统级的 appUrlOpen）。
 */
export async function registerAppUrlOpen(onOpen) {
  if (!isNative) return () => {};
  try {
    const handle = await App.addListener('appUrlOpen', ({ url }) => {
      nativeLog('appUrlOpen', url);
      onOpen?.(url);
    });
    return () => handle.remove();
  } catch (err) {
    nativeLog('register appUrlOpen error', err?.message);
    return () => {};
  }
}
