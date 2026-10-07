import React from 'react';
import {
  BrowserRouter, HashRouter, Routes, Route, Navigate,
} from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import LoginPage from './pages/LoginPage/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import MainLayout from './pages/HomePage/MainLayout';
import MobileShell from './layouts/MobileShell';
import MobileHomePage from './pages/MobileHomePage/MobileHomePage';
import MobileCalendarPage from './pages/MobileCalendarPage/MobileCalendarPage';
import MobileDirectoryPage from './pages/MobileDirectoryPage/MobileDirectoryPage';
import MobileContactDetailPage from './pages/MobileContactDetailPage/MobileContactDetailPage';
import MobileInsightsPage from './pages/MobileInsightsPage/MobileInsightsPage';
import MobileAssistantPage from './pages/MobileAssistantPage/MobileAssistantPage';
import MobileMailEditorPage from './pages/MobileMailEditorPage/MobileMailEditorPage';
import MobileSettingsPage from './pages/MobileSettingsPage/MobileSettingsPage';
import { AppDataProvider } from './hooks/useAppData';

// Minimal antd theme — layout handled by Tailwind per PRD §5
const theme = {
  token: {
    colorPrimary: '#1677FF',
    borderRadius: 8,
    colorBgLayout: '#F5F7FA',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    fontSize: 14,
  },
};

/**
 * Android 容器内页面由本地静态资源提供，没有服务端做 history fallback，
 * 因此原生平台必须使用 HashRouter；浏览器开发仍使用 BrowserRouter。
 */
const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

/**
 * 是否使用手机端外壳。
 *
 * 目前以「是否运行在 Capacitor 原生容器内」为准：
 *   - APK 内 → MobileShell（底部导航 + 语音悬浮按钮 + 各移动端页面）
 *   - 浏览器 → 保留原有桌面双栏工作台
 * 这样桌面端行为完全不受影响，方便课程演示时两种形态都能展示。
 */
const isNative = Capacitor.isNativePlatform();

/**
 * Route guard: redirect to /login if no valid token.
 */
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

/** 手机端路由表 */
function MobileRoutes() {
  return (
    <Route
      element={(
        <ProtectedRoute>
          <AppDataProvider>
            <MobileShell />
          </AppDataProvider>
        </ProtectedRoute>
      )}
    >
      <Route path="/" element={<MobileHomePage />} />
      <Route path="/calendar" element={<MobileCalendarPage />} />
      <Route path="/contacts" element={<MobileDirectoryPage />} />
      <Route path="/contacts/:id" element={<MobileContactDetailPage />} />
      <Route path="/insights" element={<MobileInsightsPage />} />
      <Route path="/assistant" element={<MobileAssistantPage />} />
      <Route path="/mail/:eventId" element={<MobileMailEditorPage />} />
      <Route path="/settings" element={<MobileSettingsPage />} />
    </Route>
  );
}

/** 桌面端路由表 */
function DesktopRoutes() {
  return (
    <Route
      path="/"
      element={(
        <ProtectedRoute>
          <AppDataProvider>
            <MainLayout />
          </AppDataProvider>
        </ProtectedRoute>
      )}
    />
  );
}

function App() {
  return (
    <ConfigProvider theme={theme} locale={zhCN}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {isNative ? MobileRoutes() : DesktopRoutes()}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
