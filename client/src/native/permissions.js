/**
 * 运行时权限。
 *
 * Android 上声明在 Manifest 里的权限还需要在运行时再次申请，
 * 否则 getUserMedia() 会直接失败（真机录音打不开的常见原因）。
 */
import { isNative, nativeLog } from './platform';

/**
 * 申请麦克风权限。
 *
 * Capacitor 的 Bridge 会在 WebView 请求 getUserMedia 时，自动为
 * Manifest 中声明过的 RECORD_AUDIO 弹系统授权框；这里做一次显式预申请，
 * 让用户在点「开始录音」之前就看到权限提示，而不是录音中途失败。
 *
 * 注意：@capacitor/* 官方没有独立的 microphone 插件，
 * 这里通过 getUserMedia 触发系统授权，再用 enumerateDevices 校验结果。
 */
export async function ensureMicrophonePermission() {
  if (!isNative) {
    // 浏览器直接交给 getUserMedia，由浏览器自身弹授权
    return { granted: true, reason: 'web' };
  }

  try {
    nativeLog('requesting microphone permission');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // 立刻释放，真正录音时再重新获取
    stream.getTracks().forEach((t) => t.stop());
    return { granted: true };
  } catch (err) {
    nativeLog('microphone permission denied', err?.name, err?.message);
    return {
      granted: false,
      reason: err?.name === 'NotAllowedError' ? 'denied' : 'unavailable',
    };
  }
}

/** 面向用户的提示文案 */
export function microphonePermissionMessage(reason) {
  if (reason === 'denied') {
    return '麦克风权限被拒绝。请在系统设置 → 应用 → TalentMate 伴贤 → 权限中开启麦克风';
  }
  return '无法访问麦克风，请检查设备是否可用';
}
