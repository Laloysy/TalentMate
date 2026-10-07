/**
 * 浮层（Drawer / Bottom Sheet / Modal）关闭器登记处。
 *
 * 为什么需要它：Android 返回键的第一优先级是「关闭已打开的浮层」，
 * 但返回键监听注册在 MobileShell 里，无法直接感知各页面内部 Drawer 的开关状态。
 * 因此由各页面在浮层打开时登记一个关闭函数，Shell 在收到返回键时按「后进先出」询问。
 *
 * 用法：
 *   useOverlayBackHandler(editorOpen, () => setEditorOpen(false));
 */
import React from 'react';
import { registerBackHandler } from './appLifecycle';

const closingHandlers = [];

/**
 * 登记一个浮层关闭器。
 * @param {() => void} close 关闭该浮层的函数
 * @returns 注销函数
 */
export function pushOverlay(close) {
  const entry = { close };
  closingHandlers.push(entry);
  return () => {
    const idx = closingHandlers.indexOf(entry);
    if (idx >= 0) closingHandlers.splice(idx, 1);
  };
}

/** 关闭最上层浮层；返回 true 表示确实关掉了一个 */
export function closeTopOverlay() {
  const entry = closingHandlers[closingHandlers.length - 1];
  if (!entry) return false;
  closingHandlers.pop();
  entry.close();
  return true;
}

/**
 * 便捷 Hook：浮层打开时自动登记，关闭或卸载时自动注销。
 * @param {boolean} isOpen 浮层是否打开
 * @param {() => void} close 关闭函数
 */
export function useOverlayBackHandler(isOpen, close) {
  const closeRef = React.useRef(close);
  closeRef.current = close;

  React.useEffect(() => {
    if (!isOpen) return undefined;
    return pushOverlay(() => closeRef.current?.());
  }, [isOpen]);
}

/**
 * 在 appLifecycle 的返回键流程里，Shell 会同时使用 registerBackHandler
 * 与本模块的 closeTopOverlay；为简化，这里直接把 closeTopOverlay 注册进去。
 */
export function installOverlayBackHandler() {
  return registerBackHandler(() => closeTopOverlay());
}
