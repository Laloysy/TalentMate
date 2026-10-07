/**
 * 平台判断与原生能力的统一入口。
 *
 * 所有 native 模块都通过这里判断运行环境，避免各处散落 Capacitor.isNativePlatform()。
 */
import { Capacitor } from '@capacitor/core';

/** 是否运行在 Android/iOS 原生容器（APK）内 */
export const isNative = Capacitor.isNativePlatform();

/** 'android' | 'ios' | 'web' */
export const platform = Capacitor.getPlatform();

/** 统一的日志前缀，便于在 chrome://inspect 或 logcat 里过滤 */
export function nativeLog(...args) {
  if (isNative) console.log('[native]', ...args);
}
