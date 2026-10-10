import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.talentmate.app',
  appName: 'TalentMate 伴贤',
  webDir: 'dist',
  backgroundColor: '#EEF3F8',
  zoomEnabled: false,

  android: {
    // 当前 API 使用 HTTP IP，因此临时允许混合内容。
    allowMixedContent: true,
    // 保持关闭。如需用 chrome://inspect 调试 WebView，请在本地临时改为 true，
    // 并且不要提交该改动（Release 构建不应开放调试端口）。
    webContentsDebuggingEnabled: true,
  },

  server: {
    // 保持 localhost，使本地 WebView 页面处于安全上下文。
    hostname: 'localhost',
    androidScheme: 'https',
    // 当前 API 使用 HTTP IP，因此临时允许明文请求。
    cleartext: true,
    errorPath: 'offline.html',
  },
};

export default config;
