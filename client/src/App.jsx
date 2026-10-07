import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import LoginPage from './pages/LoginPage/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import HomePage from './pages/HomePage/HomePage';

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
 * Route guard: redirect to /login if no valid token.
 */
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

/**
 * Android 容器内页面由本地静态资源提供，没有服务端做 history fallback，
 * 因此原生平台必须使用 HashRouter；浏览器开发仍使用 BrowserRouter。
 */
const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

function App() {
  return (
    <ConfigProvider theme={theme} locale={zhCN}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
