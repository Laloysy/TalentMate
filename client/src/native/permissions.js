/**
 * 运行时权限。
 *
 * Android 上声明在 Manifest 里的权限还需要在运行时再次申请，
 * 否则 getUserMedia() 会直接失败（真机录音打不开的常见原因）。
 */
import { isNative, nativeLog } from './platform';

/** 权限申请/取音频流的超时时间。
 *  某些设备（或无麦克风的模拟器）上 getUserMedia 会既不 resolve 也不 reject，
 *  界面就会永远停在「没有反应」的状态。加超时保证一定有反馈。 */
const MIC_TIMEOUT_MS = 10000;

/** 给 promise 加超时，超时后抛出一个可识别的错误 */
function withTimeout(promise, ms, code) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      setTimeout(() => {
        const err = new Error(code);
        err.name = code;
        reject(err);
      }, ms);
    }),
  ]);
}

/**
 * 申请麦克风权限。
 *
 * Capacitor 的 Bridge 会在 WebView 请求 getUserMedia 时，自动为
 * Manifest 中声明过的 RECORD_AUDIO 弹系统授权框；这里做一次显式预申请，
 * 让用户在点「开始录音」之前就看到权限提示，而不是录音中途失败。
 */
export async function ensureMicrophonePermission() {
  if (!isNative) {
    // 浏览器直接交给 getUserMedia，由浏览器自身弹授权
    return { granted: true, reason: 'web' };
  }

  try {
    nativeLog('requesting microphone permission');
    const stream = await withTimeout(
      navigator.mediaDevices.getUserMedia({ audio: true }),
      MIC_TIMEOUT_MS,
      'TimeoutError',
    );
    // 立刻释放，真正录音时再重新获取
    stream.getTracks().forEach((t) => t.stop());
    return { granted: true };
  } catch (err) {
    nativeLog('microphone permission denied', err?.name, err?.message);
    let reason = 'unavailable';
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') reason = 'denied';
    else if (err?.name === 'TimeoutError') reason = 'timeout';
    else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') reason = 'no-device';
    return { granted: false, reason };
  }
}

/** 面向用户的提示文案 */
export function microphonePermissionMessage(reason) {
  if (reason === 'denied') {
    return '麦克风权限被拒绝。请在系统设置 → 应用 → TalentMate 伴贤 → 权限中开启麦克风';
  }
  if (reason === 'no-device') {
    return '没有检测到可用的麦克风设备';
  }
  if (reason === 'timeout') {
    return '麦克风无响应，请检查是否有其他应用正在占用麦克风后重试';
  }
  return '无法访问麦克风，请检查设备是否可用';
}
