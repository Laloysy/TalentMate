import React from 'react';

/**
 * MobileHeader — 手机端固定顶栏。
 *
 * 左侧为页面标题（可选返回按钮），右侧为操作插槽。
 * 高度与状态栏安全区由 .mobile-header 在 mobile.css 中统一处理。
 */
function MobileHeader({ title, subtitle, onBack, right, fixed = true }) {
  return (
    <header
      className={`${fixed ? 'fixed top-0 left-0 right-0' : 'relative'} z-30
        mobile-header bg-white/95 backdrop-blur-md border-b border-slate-100`}
    >
      <div className="h-14 px-3 flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="mobile-touch w-11 h-11 -ml-1 flex items-center justify-center
              rounded-full text-slate-600 active:bg-slate-100 border-0 bg-transparent cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-slate-900 truncate leading-tight">{title}</h1>
          {subtitle && <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>}
        </div>

        {right && <div className="flex items-center gap-1 shrink-0">{right}</div>}
      </div>
    </header>
  );
}

export default MobileHeader;
