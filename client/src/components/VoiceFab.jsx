import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioOutlined } from '@ant-design/icons';

/**
 * VoiceFab — 底部中央的语音助手悬浮按钮。
 *
 * 按方案要求，语音助手不占用底部 Tab，而是通过此悬浮按钮进入，
 * 使「语音」成为全局随时可用的主入口。
 */
function VoiceFab({ to = '/assistant' }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      aria-label="打开语音助手"
      className="mobile-voice-fab fixed left-1/2 -translate-x-1/2 z-40
        w-14 h-14 rounded-full border-0 cursor-pointer
        bg-gradient-to-br from-[#1677FF] to-[#0052D9] text-white
        shadow-[0_8px_24px_rgba(22,119,255,0.45)]
        flex items-center justify-center active:scale-95 transition-transform"
    >
      <AudioOutlined className="text-xl" />
    </button>
  );
}

export default VoiceFab;
