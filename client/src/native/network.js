/**
 * 网络状态。
 *
 * 方案 §14 要求：网络中断不白屏、已加载数据不立即清空、可重试、恢复后可刷新。
 * 这里只负责「当前是否在线」以及「恢复在线」的通知，
 * 具体页面的 loading/empty/error 表现由各页面自己处理。
 */
import { Network } from '@capacitor/network';
import { isNative, nativeLog } from './platform';

/** 读取当前网络状态 */
export async function getNetworkStatus() {
  if (!isNative) return { connected: navigator.onLine, connectionType: 'unknown' };
  try {
    const status = await Network.getStatus();
    return { connected: status.connected, connectionType: status.connectionType };
  } catch (err) {
    nativeLog('getStatus error', err?.message);
    return { connected: true, connectionType: 'unknown' };
  }
}

/**
 * 监听网络变化。
 * @param {(connected:boolean) => void} onChange 仅在「连通性发生变化」时回调
 * @returns 取消监听的函数
 */
export async function watchNetwork(onChange) {
  if (!isNative) {
    const online = () => onChange?.(true);
    const offline = () => onChange?.(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }

  let last = null;
  try {
    const handle = await Network.addListener('networkStatusChange', (status) => {
      if (last !== null && last === status.connected) return; // 只在变化时通知
      last = status.connected;
      nativeLog('network changed:', status.connected, status.connectionType);
      onChange?.(status.connected);
    });
    const initial = await Network.getStatus();
    last = initial.connected;
    return () => handle.remove();
  } catch (err) {
    nativeLog('watch error', err?.message);
    return () => {};
  }
}
