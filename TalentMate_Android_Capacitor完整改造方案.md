# TalentMate Android（Capacitor）完整改造与部署方案

> 版本：V2.0  
> 更新时间：2026-09-12  
> 当前服务器：`49.232.160.212`  
> 当前 Android API：`http://49.232.160.212`  
> 技术路线：React/Vite + Capacitor Android + 腾讯云上的 Node.js/Express/MySQL

---

## 1. 方案结论

TalentMate 不需要重写后端，也不需要把 MySQL 放进 Android App。

最终结构为：

```text
Android APK
├── Capacitor Android 容器
├── APK 内置的 React/Vite 静态资源
├── 手机端专用页面布局
├── 麦克风、通知、返回键、状态栏等移动端能力
└── HTTP 请求：http://49.232.160.212/api/*
                     │
                     ▼
腾讯云服务器 49.232.160.212
├── Nginx：公网 80 端口
├── Express：仅 127.0.0.1:3001
├── MySQL：仅 Docker 内部网络
├── 腾讯云 ASR
├── DeepSeek 意图解析
├── SMTP 邮件
└── node-cron 定时任务
```

当前阶段使用服务器 IP 的 HTTP 接口，适合课程开发和受控演示。正式公开发布前，应迁移到具有有效证书的 HTTPS 地址。

---

## 2. 当前项目技术栈与可复用范围

| 层级 | 当前技术 | Android 改造方式 |
|---|---|---|
| 前端 | React 18 + Vite | 保留 React，重构移动端布局 |
| UI | Ant Design + Tailwind CSS | 可继续使用，但 Modal、日历和双栏布局需要移动化 |
| 网络 | Axios | 继续使用，API 地址改为服务器 IP |
| 后端 | Node.js + Express | 继续使用腾讯云现有服务 |
| 数据库 | MySQL 8.0 | 继续使用，不允许 Android 直连 |
| 身份认证 | JWT | 保留协议，统一处理 401 |
| 语音识别 | 腾讯云 ASR | 继续由服务端调用 |
| AI | DeepSeek API | 继续由服务端调用 |
| 邮件 | nodemailer + SMTP | 继续由服务端发送 |
| 定时任务 | node-cron | 继续在服务器运行 |
| Android 容器 | 无 | 新增 Capacitor Android |
| 移动端通知 | 无 | 新增 Android 本地通知 |

### 可以直接保留

- Express API；
- MySQL 数据和表结构；
- JWT 登录协议；
- 腾讯云 ASR；
- DeepSeek 意图解析；
- SMTP 邮件；
- node-cron 定时任务；
- Axios 请求封装；
- 联系人、日程、时间线和热力图业务逻辑。

### 需要重构

- 桌面双栏工作台；
- 固定宽度弹窗；
- 依赖 hover 的操作按钮；
- 右侧固定语音助手；
- 双栏邮件编辑与预览；
- 浏览器式新手引导；
- Android 权限、返回键、状态栏和通知。

---

## 3. 为什么采用 Capacitor

Capacitor 能直接接入现有 React/Vite 项目，将 `vite build` 生成的 `dist` 资源复制进 Android 工程，并提供 JavaScript 与 Android 原生能力之间的桥接。

本方案不是让 App 每次启动时打开线上网页，而是：

```text
React 源代码
→ vite build
→ client/dist
→ npx cap sync android
→ 静态资源写入 Android 工程
→ Android Studio 生成 APK/AAB
```

因此：

- 页面资源随 APK 安装；
- App 无网络时仍能启动到本地页面；
- 登录、业务数据、语音识别和邮件仍需要服务器；
- React 页面更新后，需要重新构建并发布 APK；
- 后端可独立更新。

正式项目中不要配置远程 `server.url` 来加载网站。

---

## 4. 推荐项目结构

```text
talentmate/
├── client/
│   ├── android/                    # Capacitor 生成的 Android 工程
│   ├── public/
│   │   └── offline.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── MobileHeader.jsx
│   │   │   ├── MobileBottomNav.jsx
│   │   │   ├── VoiceFab.jsx
│   │   │   ├── LoadingState.jsx
│   │   │   ├── ErrorState.jsx
│   │   │   └── EmptyState.jsx
│   │   ├── layouts/
│   │   │   ├── DesktopShell.jsx
│   │   │   └── MobileShell.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage/
│   │   │   ├── RegisterPage/
│   │   │   ├── MobileHomePage/
│   │   │   ├── CalendarPage/
│   │   │   ├── DirectoryPage/
│   │   │   ├── ContactDetailPage/
│   │   │   ├── InsightsPage/
│   │   │   ├── AssistantPage/
│   │   │   ├── EventEditorPage/
│   │   │   ├── ContactEditorPage/
│   │   │   └── MailEditorPage/
│   │   ├── native/
│   │   │   ├── platform.js
│   │   │   ├── appLifecycle.js
│   │   │   ├── permissions.js
│   │   │   ├── notifications.js
│   │   │   └── network.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── styles/
│   │   │   ├── global.css
│   │   │   └── mobile.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── capacitor.config.ts
│   ├── package.json
│   └── vite.config.js
├── server/
├── docker-compose.yml
└── README.md
```

业务组件和数据逻辑尽量共用，只将桌面、手机的壳层和布局分开。

---

## 5. Capacitor 接入步骤

进入前端目录：

```bash
cd client
pnpm add @capacitor/core @capacitor/android
pnpm add -D @capacitor/cli
npx cap init
npx cap add android
```

初始化建议：

```text
App name: TalentMate
App ID: com.yourteam.talentmate
Web directory: dist
```

包名需要在提交前替换为小组最终确定的唯一包名。

### 5.1 当前阶段的 Capacitor 配置

创建 `client/capacitor.config.ts`：

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourteam.talentmate',
  appName: 'TalentMate 伴贤',
  webDir: 'dist',
  backgroundColor: '#EEF3F8',
  zoomEnabled: false,

  android: {
    // 当前 API 使用 HTTP IP，因此临时允许混合内容。
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
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
```

### 5.2 构建脚本

在 `client/package.json` 中增加：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "android:sync": "vite build && cap sync android",
    "android:open": "cap open android",
    "android:run": "vite build && cap sync android && cap run android"
  }
}
```

日常开发：

```bash
pnpm run android:sync
pnpm run android:open
```

每次修改 React 代码后，都要重新执行 `android:sync`，否则 Android 工程中仍是旧构建结果。

---

## 6. API 地址配置

### 6.1 生产构建环境变量

创建 `client/.env.production`：

```dotenv
VITE_API_URL=http://49.232.160.212
```

你的前端请求已经包含 `/api`：

```js
api.get('/api/events');
```

所以 `VITE_API_URL` 后面不要再写 `/api`，最终请求应为：

```text
http://49.232.160.212/api/events
```

而不是：

```text
http://49.232.160.212/api/api/events
```

### 6.2 开发环境

Mac 本地浏览器开发可以配置：

```dotenv
VITE_API_URL=http://localhost:3001
```

Android 模拟器中的 `localhost` 指向模拟器本身，不代表开发电脑。模拟器联调时可以直接使用当前腾讯云 API：

```dotenv
VITE_API_URL=http://49.232.160.212
```

### 6.3 Axios 调整

```js
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  throw new Error('VITE_API_URL is not configured');
}

const api = axios.create({
  baseURL,
  timeout: 30000,
});

export const voiceApi = axios.create({
  baseURL,
  timeout: 90000,
});

function attachToken(config) {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

function handleError(error) {
  if (error.response?.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.hash = '#/login';
  }
  return Promise.reject(error);
}

api.interceptors.request.use(attachToken);
voiceApi.interceptors.request.use(attachToken);
api.interceptors.response.use(response => response, handleError);
voiceApi.interceptors.response.use(response => response, handleError);

export default api;
```

语音请求需要经历上传、ASR 和 AI 解析，因此应使用更长超时。

---

## 7. Android Manifest

在 `android/app/src/main/AndroidManifest.xml` 中声明：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

由于当前 API 是 HTTP IP，`application` 需要临时允许明文流量：

```xml
<application
    android:usesCleartextTraffic="true"
    android:theme="@style/AppTheme">
    <!-- 保留 Capacitor 自动生成的 Activity 和 Provider 配置 -->
</application>
```

该配置只用于当前课程开发与演示。未来切换到有效 HTTPS 后应恢复为：

```xml
android:usesCleartextTraffic="false"
```

并将 `allowMixedContent` 和 `cleartext` 一并关闭。

---

## 8. 路由方案

当前项目使用 `BrowserRouter`。Android 本地静态资源建议使用 `HashRouter`：

```jsx
import { Capacitor } from '@capacitor/core';
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
} from 'react-router-dom';

const Router = Capacitor.isNativePlatform()
  ? HashRouter
  : BrowserRouter;

function App() {
  return (
    <Router>
      <Routes>
        {/* 页面路由 */}
      </Routes>
    </Router>
  );
}
```

建议路由：

```text
/login
/register
/home
/calendar
/contacts
/contacts/:id
/insights
/assistant
/events/new
/events/:id/edit
/contacts/new
/contacts/:id/edit
/mail/:eventId
/settings
```

---

## 9. 手机端总体信息架构

### 一级导航

```text
首页｜日程｜名册｜洞察
```

语音助手使用底部中央悬浮按钮打开，不占普通 Tab。

### 二级页面

- 联系人详情与时间线；
- 添加/编辑联系人；
- 添加/编辑日程；
- 邮件编辑与预览；
- 设置与退出登录。

### MobileShell

```jsx
function MobileShell() {
  return (
    <div className="mobile-shell">
      <MobileHeader />
      <main className="mobile-content">
        <Outlet />
      </main>
      <VoiceFab />
      <MobileBottomNav />
    </div>
  );
}
```

原则：

- 每页只有一个主要滚动容器；
- 底部导航固定；
- 内容区预留底部导航和安全区；
- 不依赖 hover；
- 主要触控区域不小于约 44 × 44 px。

---

## 10. 页面修改方案

## 10.1 登录页

当前固定宽度 Card 改为手机全屏表单：

```text
TM Logo
TalentMate 伴贤
语音驱动的职场关系关怀助手

用户名
密码
进入工作台

还没有账户？立即注册
```

要求：

- 手机端移除固定宽度；
- 使用 `100dvh`；
- 输入框和主按钮高度至少 48 px；
- 键盘弹起后页面可滚动；
- 登录期间禁止重复提交；
- 保留桌面 Card 作为响应式分支。

示例：

```jsx
<div className="min-h-[100dvh] px-6 pt-[max(56px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] overflow-y-auto">
```

## 10.2 注册页

推荐分成两步：

1. 用户名、邮箱；
2. 密码、确认密码、邮件提醒说明。

如果保留单页：

- 页面必须纵向滚动；
- 错误信息紧贴字段；
- 软键盘不能遮挡当前输入框；
- 密码规则在输入前显示；
- 提交期间禁止重复点击。

## 10.3 手机首页

新增首页，而不是一进入 App 就加载完整月历和聊天面板。

```text
早上好，用户名
今天也别忘了维护重要关系

关系概览
高优先级 2｜需关注 4｜已安排 6

今日安排
10:00 和张伟 1对1
15:00 候选人面试

需要关注的人
张伟 · 42 天未沟通
李婷 · 候选人待跟进

快捷操作
新建日程｜添加联系人｜语音安排
```

数据来源：

- `GET /api/events`；
- `GET /api/insights/relationship-heatmap`；
- `GET /api/contacts`。

首页只展示摘要，点击后进入对应详细页。

## 10.4 日程页

页面顶部：

```text
日程                              ＋
[关怀列表] [月历]
```

手机端默认显示关怀列表。

### 列表模式

```text
今天 · 6月12日
10:00–11:00
张伟 1对1
研发部 · 提前10分钟提醒            ⋮
```

`⋮` 菜单包含：

- 编辑；
- 预览邮件；
- 删除。

不能继续使用只在 hover 时出现的按钮。

### 月历模式

日期格只显示：

- 日期；
- 最多 3 个事件圆点；
- 超出事件数量。

点击日期打开 Bottom Sheet，展示当天事件和“添加日程”。

### 添加/编辑日程

桌面 Modal 改为全屏页或全屏 Drawer：

```text
← 添加关怀安排                    保存

事项标题
开始日期
开始时间
结束日期
结束时间
关联联系人
关怀类型
提前提醒
```

日期和时间拆开选择。

### 修复月份边界

当前月份计算在 12 月可能产生非法月份。改为：

```js
const monthStart = dayjs(selectedDate).startOf('month');
const nextMonthStart = monthStart.add(1, 'month');

const startDate = monthStart.format('YYYY-MM-DD');
const endDate = nextMonthStart.format('YYYY-MM-DD');
```

## 10.5 名册页

```text
人才名册                             ＋

联系人 20｜待关注 5｜已安排 8

[搜索姓名、邮箱、部门或岗位]
[全部] [员工] [候选人]

张伟
研发部 · 产品经理
需关注 · 32 天未沟通                     >
```

修改要求：

- 固定单列列表；
- 搜索和筛选适配窄屏；
- 点击联系人进入详情；
- 编辑和删除移到详情页或操作菜单；
- 删除二次确认；
- 使用 FAB 添加联系人；
- 状态同时显示文字，不只依赖颜色。

CSV 功能应区分：

- 从文件导入；
- 粘贴 CSV 内容。

如果第一版只支持文本粘贴，按钮应明确命名为“粘贴 CSV”。

## 10.6 联系人详情与时间线

改为独立页面：

```text
← 张伟

头像
研发部 · 产品经理
zhang@example.com

[安排沟通] [编辑资料] [写邮件]

关系状态
需关注 · 32 天未沟通

互动时间线
● 创建 1 对 1 日程
│  6月10日 10:30
● 保存邮件草稿
│  6月8日 16:20
```

页面根据路由中的 `contactId` 自行请求：

```text
GET /api/contacts/:id/timeline
```

这样页面刷新或由通知跳转进入时仍能恢复数据。

## 10.7 关系洞察页

```text
关系洞察

高优先级 2
需关注   4
已安排   6

[全部] [员工] [候选人]

高优先级
张伟      42 天未沟通      安排关怀
王芳      35 天未跟进      安排关怀
```

排序：

```text
高优先级 → 需关注 → 已安排 → 正常 → 新联系人
```

每项展示：

- 状态文字；
- 状态原因；
- 最近互动或已安排时间；
- 查看详情或安排关怀按钮。

## 10.8 语音助手

通过底部中央麦克风按钮打开全屏助手或大尺寸 Bottom Sheet。

```text
关怀助手                           ×

你：明天下午三点安排和张伟的一对一

助手：找到两位张伟，请选择
[张伟 · 产品部]
[张伟 · 技术部]

                      [点击开始录音]
```

必须明确区分：

```text
idle        等待录音
recording   正在录音并显示时长
uploading   正在上传音频
processing  正在识别和执行
success     展示结果和后续操作
error       展示原因和重试入口
```

第一版保留现有录音链路：

```text
getUserMedia
→ AudioContext
→ 16 kHz、16-bit、单声道 WAV
→ POST /api/voice/recognize
```

必须真机验证：

- 首次允许权限；
- 拒绝权限；
- 从设置重新授权；
- 录音开始和停止；
- 短录音和静音；
- 切换后台；
- 连续点击；
- ASR 或 AI 失败后的重试。

## 10.9 邮件编辑与预览

原 920 px 双栏 Modal 改为全屏页面：

```text
← 邮件草稿                         保存

收件人：张伟
主题：[一对一沟通提醒]

[编辑] [预览]

正文输入区或邮件预览
```

要求：

- 编辑和预览使用 Tab；
- 保存按钮固定在安全区内；
- 离开前提醒未保存内容；
- 生成预览失败时保留用户内容；
- 保存后返回日程或联系人详情。

当前使用 `dangerouslySetInnerHTML`，必须对邮件 HTML 做净化，禁止：

- `<script>`；
- `onclick` 等事件属性；
- `javascript:` URL；
- 不受控 iframe；
- 自动跳转或可执行内容。

## 10.10 新手引导

手机端重新设计 3 页引导：

1. 建立人才名册；
2. 查看关系温度；
3. 用语音安排互动。

只在用户开始使用对应能力时申请麦克风或通知权限，避免首次启动连续弹出系统权限框。

---

## 11. 移动端 CSS 基础

在 `client/index.html` 中加入：

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
```

全局样式：

```css
html,
body,
#root {
  margin: 0;
  min-height: 100%;
  background: #eef3f8;
  overscroll-behavior: none;
}

body {
  -webkit-tap-highlight-color: transparent;
}

button,
input,
textarea,
select {
  font: inherit;
}

.mobile-shell {
  min-height: 100dvh;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.mobile-content {
  min-height: 0;
  overflow-y: auto;
  padding-bottom: calc(76px + env(safe-area-inset-bottom));
}

.mobile-bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 64px;
  padding-bottom: env(safe-area-inset-bottom);
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid #e5e7eb;
}

.touch-target {
  min-width: 44px;
  min-height: 44px;
}

@media (max-width: 767px) {
  .desktop-only {
    display: none !important;
  }

  .mobile-only {
    display: block;
  }

  .ant-modal {
    max-width: 100%;
    margin: 0;
    top: 0;
    padding-bottom: 0;
  }
}

@media (min-width: 768px) {
  .mobile-only {
    display: none !important;
  }
}
```

设计建议：

| 项目 | 建议值 |
|---|---|
| 页面左右边距 | 16 px |
| 卡片内边距 | 14–16 px |
| 页面标题 | 20–24 px |
| 正文 | 14–16 px |
| 辅助文字 | 12–13 px |
| 主要按钮高度 | 48–52 px |
| 最小点击区域 | 44 × 44 px |
| 卡片圆角 | 12–16 px |

---

## 12. Android 原生体验

### 12.1 App 图标

准备：

- 1024 × 1024 主图标源文件；
- Adaptive Icon 前景；
- Adaptive Icon 背景；
- 单色通知图标。

### 12.2 启动页

```text
浅灰蓝背景
TM 标志
TalentMate 伴贤
语音驱动的职场关系关怀助手
```

启动页只负责品牌展示和初始化，不等待长时间网络请求。

### 12.3 状态栏和安全区

- 浅色页面使用深色状态栏图标；
- 页面不被刘海、状态栏和手势导航区遮挡；
- 键盘弹出时当前输入框保持可见；
- 全屏表单、语音页和邮件页均处理安全区。

### 12.4 Android 返回键

建议规则：

```text
如果 Modal 或 Bottom Sheet 已打开 → 先关闭
否则如果位于二级页面 → 返回上一页
否则如果当前不是首页 → 切换首页
否则 → 再按一次退出
```

---

## 13. 本地通知方案

现有 SMTP 邮件继续保留，Android 增加本地通知。

### 流程

```text
登录或 App 回到前台
→ 获取未来 7 天日程
→ 根据 reminder 计算提醒时间
→ 安排本地通知
→ 修改日程时取消旧通知并重建
→ 删除日程时取消对应通知
```

通知示例：

```text
TalentMate 提醒
10 分钟后：和张伟进行 1 对 1 沟通
```

点击通知进入：

```text
#/calendar?eventId=123
```

必须处理：

- Android 通知权限；
- 重复同步不产生重复通知；
- 修改日程更新通知；
- 删除日程取消通知；
- 已过期日程不创建通知；
- 退出登录清除用户通知。

课程第一版不必先做 FCM。

---

## 14. 网络与异常状态

因为数据、ASR 和 AI 位于服务器，第一版不做完整离线业务，但必须做到：

- App 本地页面始终可以启动；
- 网络中断不白屏；
- 已加载数据不立即清空；
- 用户可以重试；
- 网络恢复后可以刷新。

每个数据页面至少有：

```text
loading
success
empty
error
refreshing
```

错误类型应区分：

- 无网络；
- 后端不可用；
- 请求超时；
- 登录过期；
- 业务校验失败；
- 服务器内部错误。

`offline.html` 只负责 Capacitor 容器级错误，业务 API 失败由 React 页面处理。

---

## 15. 腾讯云服务器当前状态

### 15.1 已完成修改

服务器已实际完成以下调整：

- 已备份原配置和数据库；
- MySQL 不再映射到宿主机公网端口；
- Express 只绑定 `127.0.0.1:3001`；
- Nginx 通过公网 80 端口提供 `/api/*`；
- Nginx 将请求反向代理到 `127.0.0.1:3001`；
- Nginx 上传限制为 12 MB；
- Nginx API 读取和发送超时为 120 秒；
- CORS 允许 Capacitor 默认来源 `https://localhost`；
- CORS 保留本地开发和当前 IP 来源；
- 不可信来源不会获得 CORS 授权响应头；
- 语音请求完成或断开后删除临时音频；
- Docker Compose 已移除废弃的顶层 `version` 字段；
- Docker 服务已经重新构建并启动。

备份目录：

```text
/root/talentmate-backups/20260912_103556/
```

该目录包含原配置和数据库 SQL 备份。

### 15.2 已验证结果

```text
公网 API：
http://49.232.160.212/api/health
返回：{"success":true,"message":"Server is running"}

容器：
voice-calendar-db      healthy
voice-calendar-server  running

端口：
80    公网监听，由 Nginx 提供 HTTP API
3001  仅监听 127.0.0.1
3306  不再映射到宿主机

公网探测：
3001 closed_or_filtered
3306 closed_or_filtered

数据库现有记录：
users=2
contacts=1
events=1

语音上传目录：
当前临时文件数量为 0
```

### 15.3 当前 Nginx IP API 配置

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 49.232.160.212;

    client_max_body_size 12m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location / {
        return 404;
    }
}
```

### 15.4 当前 Docker Compose 端口原则

```yaml
services:
  db:
    image: mysql:8.0
    # 不设置 ports，数据库只在 Docker 网络内访问

  server:
    ports:
      - '127.0.0.1:${PORT:-3001}:3001'
```

Android 访问链路为：

```text
Android
→ http://49.232.160.212:80/api/*
→ Nginx
→ 127.0.0.1:3001
→ Express
→ Docker 内部 MySQL
```

### 15.5 当前 CORS 白名单

```js
const allowedOrigins = new Set([
  'https://localhost',
  'http://localhost',
  'http://localhost:3000',
  'http://49.232.160.212',
  'https://49.232.160.212',
]);
```

其中 Android Capacitor 打包页面主要使用：

```text
Origin: https://localhost
```

已验证预检响应：

```text
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://localhost
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization
```

### 15.6 腾讯云安全组待确认

服务器操作系统和 Docker 已不再对公网监听 3001、3306，但仍需在腾讯云控制台检查安全组。

删除以下公网入站规则（如果存在）：

```text
TCP 3001 from 0.0.0.0/0
TCP 3306 from 0.0.0.0/0
```

保留：

```text
TCP 80   当前 Android HTTP API
TCP 22   SSH，建议仅允许管理者固定 IP
TCP 443  未来 HTTPS 使用
```

云安全组属于腾讯云控制台配置，不能仅通过服务器内部的 Nginx 或 Docker 设置替代。

---

## 16. 当前 HTTP IP 方案的安全边界

当前 Android API 使用：

```text
http://49.232.160.212
```

HTTP 会明文传输：

- 用户名和密码；
- JWT；
- 联系人资料；
- 日程内容；
- 录音文件；
- AI 处理结果。

因此当前方案仅适合：

- 课程开发；
- 受控测试；
- 临时演示。

不适合：

- 正式公开发布；
- 真实敏感联系人数据；
- 不可信公共 Wi-Fi；
- 长期生产使用。

不得通过忽略证书错误的方式调用 `https://49.232.160.212`。当前服务器的既有 HTTPS 证书不覆盖该 IP，因此 Android 不应使用该 HTTPS IP 地址。

未来迁移到有效 HTTPS 时，需要把 `VITE_API_URL` 改为届时已验证可用的 HTTPS API 地址；本文不预填任何旧域名或未确认地址。

```ts
android: {
  allowMixedContent: false,
}

server: {
  cleartext: false,
}
```

```xml
android:usesCleartextTraffic="false"
```

上述 HTTPS 配置是未来状态，不是当前构建配置。

---

## 17. 服务端继续整改项

以下事项尚未实施，建议按优先级继续处理。

### P0：接口限流

重点保护：

```text
POST /api/auth/login
POST /api/auth/register
POST /api/voice/recognize
POST /api/mail/preview
```

语音、AI 和邮件接口会消耗外部服务额度，应限制短时间重复请求。

### P0：邮件 HTML 净化

服务端邮件模板和用户可编辑正文必须限制：

- `<script>`；
- 事件属性；
- `javascript:` URL；
- iframe；
- 自动跳转内容。

### P1：日期与时区统一

API 应统一：

- 存储时区；
- 返回格式；
- 用户时区；
- 全天事件规则；
- 开始和结束时间边界。

建议逐步切换为带时区的 ISO 8601。

### P1：日志脱敏

生产日志不得记录：

- JWT；
- 密码；
- SMTP 凭证；
- 云服务密钥；
- 完整音频；
- 不必要的联系人敏感信息。

### P1：数据库账户

当前 Docker 使用 MySQL root 账户。后续应创建权限受限的业务账户，只授权 TalentMate 数据库所需操作。

### P2：HTTPS 恢复

正式发布前应配置稳定 HTTPS 入口，并撤销 Android 的明文流量权限。

---

## 18. 登录状态与安全

第一版可以继续使用 WebView `localStorage` 保存 JWT，以降低改造成本。

建议后续改为：

- JWT：安全存储；
- 用户名：Preferences；
- 是否看过引导：Preferences；
- 通知同步时间：Preferences。

收到 401 时：

```text
停止当前请求
→ 清除 JWT 和用户信息
→ 清除本地通知
→ 跳转登录页
→ 显示“登录已过期，请重新登录”
```

外部链接处理：

- App 自有路由留在内部；
- 外部 HTTP/HTTPS 链接交给系统浏览器；
- `mailto:` 交给邮件 App；
- `tel:` 交给拨号 App；
- 未知 scheme 不执行。

---

## 19. 性能优化

### 前端

- 按路由拆包；
- 延迟加载日历和邮件预览；
- 首页不加载完整月历；
- 长列表使用分页或虚拟列表；
- 删除无必要的调试日志；
- 避免 render 时重复全量过滤；
- 语音结果更新后只刷新受影响数据。

### 网络

- 联系人、热力图和日程并行加载；
- 普通接口和语音接口使用不同超时；
- 防止重复点击产生重复请求；
- App 回到前台时按需刷新。

### Android

- 先展示本地页面，再请求服务器；
- 首屏不初始化非必要插件；
- 发布版关闭 WebView 调试；
- 在较低配置的真机上测试启动和滚动。

---

## 20. 分阶段实施计划

## 阶段 0：基线确认

- 验证现有 Web 项目；
- 记录已有问题；
- 建立 Android 改造分支；
- 确认当前公网 API 健康。

验收：

```text
http://49.232.160.212/api/health
→ {"success":true,"message":"Server is running"}
```

## 阶段 1：Capacitor Android 跑通

- 安装 Capacitor；
- 生成 Android 工程；
- 配置 `webDir: dist`；
- 配置 HTTP IP API；
- 配置 Android 明文流量；
- 构建并在模拟器、真机启动。

验收：

- APK 能打开；
- 页面来自 APK 本地资源；
- 登录和退出可用；
- API 调用成功；
- 返回键不导致白屏。

## 阶段 2：移动端导航

- 新增 MobileShell；
- 加入底部导航；
- 新增首页；
- 将语音助手改为全屏或 Bottom Sheet；
- 将联系人详情和邮件编辑拆成独立页面。

## 阶段 3：逐页改版

- 登录和注册；
- 日程列表和月历；
- 日程编辑；
- 名册；
- 联系人详情；
- 洞察；
- 语音助手；
- 邮件编辑与预览；
- 新手引导。

## 阶段 4：原生体验

- 麦克风权限；
- 真机录音；
- 本地通知；
- 网络状态；
- 启动页和图标；
- 状态栏；
- Android 返回键；
- 外部链接处理。

## 阶段 5：稳定性与安全

- 接口限流；
- 邮件 HTML 净化；
- 日期与时区统一；
- 日志脱敏；
- 数据库业务账户；
- 真机异常测试。

## 阶段 6：发布

- 构建 Release APK/AAB；
- 配置签名；
- 准备测试账户；
- 完成验收清单；
- 录制演示视频；
- 整理课程材料。

---

## 21. 六人小组分工

| 成员 | 主要职责 | 交付内容 |
|---|---|---|
| 成员 1 | Capacitor 与 Android 工程 | Android 工程、权限、图标、启动页、APK/AAB |
| 成员 2 | 移动端基础体验 | MobileShell、底部导航、登录注册、首页 |
| 成员 3 | 日程模块 | 日程列表、月历、编辑页、本地通知 |
| 成员 4 | 联系人模块 | 名册、搜索筛选、详情页、CSV、时间线 |
| 成员 5 | 语音与 AI | 录音、上传、状态机、同名联系人选择 |
| 成员 6 | 洞察、邮件和后端 | 热力洞察、邮件页面、后端优化、集成测试 |

共同规则：

- 每人负责的功能必须接真实 API；
- 覆盖加载、空数据、成功、失败和重试；
- 不用静态页面代替业务完成；
- 公共组件和接口模型统一维护；
- 合并前通过构建和核心流程检查。

---

## 22. 六周排期示例

| 周次 | 目标 |
|---|---|
| 第 1 周 | 基线确认、Capacitor 接入、Android 工程启动、API 连通 |
| 第 2 周 | MobileShell、底部导航、登录注册、首页 |
| 第 3 周 | 日程与联系人移动端改版 |
| 第 4 周 | 语音助手、联系人歧义、邮件与洞察 |
| 第 5 周 | 通知、权限、异常恢复、后端安全整改 |
| 第 6 周 | 真机测试、修复、Release 打包、演示和文档 |

每周结束保留一个可安装版本，避免最后一周才进行集成。

---

## 23. 测试方案

### 23.1 核心业务

- 注册、登录和退出；
- 登录过期；
- 联系人增删改查；
- 搜索和筛选；
- CSV 导入；
- 日程增删改查；
- 日程绑定联系人；
- 语音添加、查询、修改和删除；
- 同名联系人选择；
- 关系洞察；
- 互动时间线；
- 邮件预览与草稿保存；
- SMTP 提醒；
- Android 本地通知。

### 23.2 权限

麦克风：

- 首次允许；
- 首次拒绝；
- 永久拒绝；
- 从设置重新开启；
- 录音中切换后台；
- 音频被其他应用中断。

通知：

- 首次允许；
- 拒绝；
- 系统设置关闭；
- 修改日程后更新；
- 删除日程后取消。

### 23.3 网络

- 正常 Wi-Fi；
- 移动网络；
- 无网络启动；
- 请求过程中断网；
- 高延迟；
- 后端 500；
- 请求超时；
- 服务器 IP 不可达。

### 23.4 UI 尺寸

至少验证：

```text
360 × 800
393 × 873
412 × 915
```

检查：

- 无横向滚动；
- 文本不重叠；
- 底部导航不遮挡内容；
- 键盘不遮挡输入；
- 弹层可以关闭；
- 长姓名、邮箱和标题不破坏布局；
- 字体放大后主要操作仍可用。

### 23.5 生命周期

- 冷启动；
- 前后台切换；
- 锁屏与解锁；
- 进程被系统回收后重启；
- 屏幕旋转；
- 点击通知启动；
- 二级页面使用 Android 返回键。

### 23.6 安全

- APK 中没有云服务或数据库密钥；
- 未登录不能访问业务 API；
- A 用户不能读取 B 用户数据；
- 邮件 HTML 中脚本不执行；
- 非法或过大音频被拒绝；
- 登录和语音限流生效；
- 生产日志不输出 JWT 或密码；
- 公网无法连接 3001 和 3306。

---

## 24. 发布流程

构建：

```bash
cd client
pnpm install
pnpm run build
npx cap sync android
npx cap open android
```

Android Studio 中：

- 选择 release；
- 确认包名；
- 设置版本号；
- 配置签名；
- 生成 APK 或 AAB；
- 在真实设备安装 release 包；
- 重新执行核心流程。

版本建议：

```text
versionName: 1.0.0
versionCode: 1
```

签名文件要求：

- 不提交到公开仓库；
- 密码不写入 README；
- 指定一名成员保管；
- 做安全备份。

---

## 25. 课程项目表达

Proposal 中应明确区分：

### 原有基础

- React Web 版本；
- Express API；
- MySQL 数据；
- 基础联系人、日程和语音逻辑；
- 邮件和互动时间线。

### 本课程新增

- Capacitor Android 工程；
- 手机端信息架构和页面重构；
- Android 麦克风权限与真机录音；
- Android 本地通知；
- 生命周期和返回键；
- 网络异常与离线启动体验；
- 邮件 HTML 安全整改；
- 服务端端口收紧和音频清理；
- APK/AAB 构建与真机测试。

课程要求对应：

| 课程要求 | TalentMate 对应点 |
|---|---|
| 核心功能完整 | 名册、日程、语音、洞察、时间线和邮件构成闭环 |
| 体现原创想法 | 面向 Team Lead、HR 和猎头的关系关怀工作台 |
| 工作量适合六人 | 移动端、语音、通知、后端、安全和测试可拆分 |
| 像完整产品 | 登录、权限、通知、真实后端、异常处理和安装包齐全 |
| AI 加分方向 | ASR + DeepSeek 解析自然语言并执行日程操作 |

由于项目建立在此前作品上，应主动向教师说明：

- 原项目开发时间和范围；
- 课程开始前已有代码；
- 本学期新增的 Android 能力；
- 每名成员负责的新增内容；
- 使用的第三方框架和依赖。

---

## 26. MVP 与增强项

### MVP 必须包含

- Android APK；
- APK 内置 React 页面；
- 手机底部导航；
- 登录注册；
- 日程管理；
- 联系人管理；
- 联系人时间线；
- 关系洞察；
- 真机语音录入；
- 同名联系人选择；
- 邮件预览和草稿；
- 基础本地通知；
- 网络错误和登录过期处理。

### 推荐增强项

1. 完善本地通知；
2. 系统文件选择器导入 CSV；
3. 联系人一键发邮件；
4. 首页 Widget；
5. 生物识别解锁；
6. Android 系统日历同步；
7. 邮件失败重试；
8. 关系趋势和部门分组；
9. 离线缓存；
10. FCM 推送。

核心流程未稳定前，不要同时开发大量增强功能。

---

## 27. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 当前使用 HTTP IP | 凭证、JWT 和语音明文传输 | 仅用于课程联调；正式发布前迁移 HTTPS |
| WebView 录音兼容性 | 语音核心功能不可用 | 第一周真机验证，必要时改原生录音插件 |
| 桌面 UI 直接缩放 | 手机体验差 | 建立 MobileShell 并逐页重构 |
| Ant Design Modal 不适配 | 表单被遮挡 | 手机端改全屏 Drawer 或独立页 |
| API 地址配置错误 | APK 所有请求失败 | 构建时检查 `VITE_API_URL` 不为空 |
| 通知重复 | 用户收到重复提醒 | 使用事件 ID 作为通知 ID，更新前取消 |
| 邮件 HTML 注入 | 安全风险 | 固定模板、文本转义和 HTML 净化 |
| 课程既有项目复用争议 | 学术诚信风险 | 明确原有与新增范围，并取得教师确认 |
| 后期集中集成 | 进度失控 | 每周保留一个可安装版本 |

---

## 28. 最低验收清单

### 构建

- [ ] `pnpm run build` 成功；
- [ ] `npx cap sync android` 成功；
- [ ] Android Studio 构建成功；
- [ ] Release APK/AAB 生成成功；
- [ ] 真机可安装和启动。

### 页面

- [ ] 登录页适配手机；
- [ ] 注册页适配键盘；
- [ ] 首页摘要完整；
- [ ] 日程列表和月历可切换；
- [ ] 名册支持搜索和筛选；
- [ ] 联系人详情可直接刷新；
- [ ] 洞察状态有文字说明；
- [ ] 语音助手不依赖桌面右栏；
- [ ] 邮件编辑和预览适配手机；
- [ ] 所有操作不依赖 hover。

### 功能

- [ ] 注册、登录和退出；
- [ ] JWT 自动附加；
- [ ] 401 自动退出；
- [ ] 联系人 CRUD；
- [ ] 日程 CRUD；
- [ ] 语音识别和意图执行；
- [ ] 同名联系人选择；
- [ ] 热力洞察；
- [ ] 互动时间线；
- [ ] 邮件预览和草稿保存；
- [ ] 本地通知。

### 设备

- [ ] 麦克风允许与拒绝；
- [ ] 通知允许与拒绝；
- [ ] Android 返回键；
- [ ] 前后台切换；
- [ ] 点击通知跳转；
- [ ] 断网和恢复；
- [ ] 键盘不遮挡输入。

### 服务器与安全

- [x] 公网 HTTP API 可用；
- [x] Express 仅监听本机 3001；
- [x] MySQL 未映射宿主机端口；
- [x] 公网 3001、3306 探测关闭或过滤；
- [x] Capacitor 来源 CORS 预检通过；
- [x] 语音临时文件清理已部署；
- [x] 配置和数据库已备份；
- [ ] 腾讯云安全组规则人工复核；
- [ ] 接口限流；
- [ ] 邮件 HTML 净化；
- [ ] 数据库业务账户；
- [ ] 正式 HTTPS。

---

## 29. 第一条端到端链路

第一周优先打通：

```text
安装 APK
→ 登录
→ 获取联系人
→ 创建日程
→ 返回列表看到新日程
→ 退出 App 后重新进入
→ 数据仍存在
```

第二条链路：

```text
申请麦克风权限
→ 录音
→ 上传到 http://49.232.160.212/api/voice/recognize
→ 腾讯云 ASR
→ DeepSeek 解析
→ 创建日程
→ App 展示结果
```

这两条链路稳定后，再扩展洞察、时间线、邮件和通知。

---

## 30. 最终交付物

```text
TalentMate.apk
Android/React 前端源代码
Express 后端源代码
数据库初始化 SQL
部署与运行说明
测试账户
项目 Proposal
系统架构图
页面流程图
小组分工说明
功能测试清单
演示视频
已知限制说明
```

演示顺序：

```text
登录
→ 首页查看待关注关系
→ 打开名册查看联系人
→ 语音安排一次 1 对 1
→ 完成同名联系人选择
→ 日程自动创建
→ 邮件预览并保存草稿
→ 查看联系人互动时间线
→ 展示关系洞察
→ 展示 Android 本地通知
```

---

## 31. 参考资料

- Capacitor 安装与接入现有 Web 项目：<https://capacitorjs.com/docs/getting-started>
- Capacitor Android：<https://capacitorjs.com/docs/android>
- Capacitor 配置：<https://capacitorjs.com/docs/config>

---

## 32. 最终建议

当前应按以下状态实施 Android 客户端：

```text
VITE_API_URL=http://49.232.160.212
allowMixedContent=true
server.cleartext=true
android:usesCleartextTraffic=true
```

服务器已经能够继续承载：

- MySQL；
- Express API；
- 腾讯云 ASR；
- DeepSeek；
- SMTP 邮件；
- node-cron 定时任务。

Android 改造的主要工作是：

- 接入 Capacitor；
- 重构手机端页面；
- 接入权限、通知和生命周期；
- 完成真机录音与业务闭环；
- 完成剩余服务端安全整改。

成功标准不是网页能在 APK 中打开，而是：

- 页面真正适配手机；
- 核心业务形成完整闭环；
- Android 权限和返回行为可靠；
- 网络异常可以恢复；
- 服务端密钥不进入 APK；
- Release 安装包能在真机稳定演示；
- 正式发布前完成 HTTPS 迁移。
