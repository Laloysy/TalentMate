import React from 'react';

/**
 * MobileAuthLayout — 登录 / 注册页的移动端外壳。
 *
 * 要点（对应方案 10.1 / 10.2）：
 *   - 使用 100dvh，避免移动端浏览器地址栏导致的高度跳动
 *   - 顶部预留状态栏安全区，底部预留手势条安全区
 *   - 键盘弹起后页面可纵向滚动，且当前输入框不会被遮挡
 */
function MobileAuthLayout({ children }) {
  return (
    <div className="min-h-[100dvh] bg-[#EEF3F8] overflow-y-auto">
      <div
        className="min-h-[100dvh] max-w-[440px] mx-auto px-6 flex flex-col justify-center"
        style={{
          paddingTop: 'max(24px, env(safe-area-inset-top))',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default MobileAuthLayout;
