/**
 * Axios instance with base URL and JWT interceptor.
 * All API requests must go through this instance.
 *
 * 所有调用方已自带 `/api` 前缀，因此 VITE_API_URL 只写主机名，
 * 例如 http://49.232.160.212，最终请求为 http://49.232.160.212/api/events。
 */
import axios from 'axios';
import { Capacitor } from '@capacitor/core';

// 生产构建由 .env.production 注入；开发环境留空以走 Vite 代理。
const baseURL = import.meta.env.VITE_API_URL || '';

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
