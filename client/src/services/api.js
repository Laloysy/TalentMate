/**
 * Axios instance with base URL and JWT interceptor.
 * All API requests must go through this instance.
 *
 * 所有调用方已自带 `/api` 前缀，接口根地址见下面的 baseURL 说明。
 */
import axios from 'axios';
import { Capacitor } from '@capacitor/core';

/**
 * 接口根地址按运行环境区分：
 *
 * - 原生 App：Capacitor 的页面源是 `https://localhost`，相对路径会打到设备本机，
 *   必须用绝对地址。WebView 已开启 allowMixedContent，HTTP 后端可用。
 * - 网页：一律走**同源相对路径**。页面是 HTTPS 时接口自动是 HTTPS，
 *   不会被浏览器判为混合内容（此前的报错就是 HTTPS 页面请求 http://49.232.160.212）。
 *   nginx 与 Node 服务同源反代 /api，所以相对路径在 IP 和域名下都成立。
 *
 * VITE_API_URL 仅用于原生包；网页构建即使带着它也会被忽略。
 */
const NATIVE_FALLBACK = 'http://49.232.160.212';
const configured = import.meta.env.VITE_API_URL || '';

const baseURL = Capacitor.isNativePlatform()
  ? (configured || NATIVE_FALLBACK)
  : '';

const api = axios.create({
  baseURL,
  timeout: 30000,
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      // 原生平台使用 HashRouter，直接改 pathname 会失效。
      if (Capacitor.isNativePlatform()) {
        window.location.hash = '#/login';
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
