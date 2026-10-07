# TalentMate Android 构建说明（Capacitor）

> 本文档记录已完成的 Android 接入工作、本机环境要求，以及每个阶段的构建命令。
> 完整改造方案见项目根目录 `TalentMate_Android_Capacitor完整改造方案.md`。

---

## 1. 当前完成状态

已完成方案中的 **阶段 0（基线确认）**、**阶段 1（Capacitor 跑通）**、
**阶段 2（移动端导航）** 与 **阶段 4（原生体验）**：

| 项目 | 状态 |
|---|---|
| Web 项目可构建（`vite build` → `dist/`） | ✅ |
| Capacitor 依赖与配置 | ✅ |
| Android 原生工程（`client/android/`） | ✅ |
| 静态资源打包进 APK（非远程加载网页） | ✅ |
| API 指向 `http://49.232.160.212` | ✅ |
| Android 明文流量放行（当前 HTTP 阶段） | ✅ |
| 生成 Debug APK | ✅ `app-debug.apk` |
| MobileShell + 底部四 Tab 导航 | ✅ |
| 手机端首页 / 日程 / 名册 / 洞察 / 助手 / 设置 | ✅ |
| 联系人详情 + 互动时间线 | ✅ |
| 全屏编辑页替代桌面 Modal | ✅ |
| 登录 / 注册页移动化 | ✅ |
| **麦克风运行时权限** | ✅ 已验证弹窗并授权 |
| **本地通知（排期 / 投递 / 点击跳转）** | ✅ 已验证真实投递 |
| **Android 返回键四级规则** | ✅ 三条路径均已验证 |
| **应用图标 + 启动页** | ✅ 自适应图标，已在桌面确认 |
| **状态栏样式** | ✅ 深色图标 + 白色背景 |
| **网络状态监听** | ✅ 已接入（详见 §native） |
| **邮件草稿移动端独立页** | ✅ 全屏页 + Tab 切换 + 未保存确认 |
| **邮件 HTML 净化** | ✅ 15 项注入用例全部通过 |
| **移动端 3 页新手引导** | ✅ 按需申请权限，不再启动即弹窗 |
| **通知权限改为按需申请** | ✅ 用户设置提醒时才弹系统框 |
| 真机/模拟器验证 | ✅ 见下方"验收结果" |

尚未开始：真机（非模拟器）录音实测、Release 签名与 AAB、
HTTPS 迁移、服务端限流与邮件净化（方案阶段 5）、离线业务能力。

### 阶段 2 交付内容

```text
client/src/
├── layouts/MobileShell.jsx              # 手机外壳：底部导航 + 语音悬浮按钮
├── components/
│   ├── MobileHeader.jsx                 # 固定顶栏（含返回按钮与右侧操作）
│   ├── MobileBottomNav.jsx              # 底部四 Tab：首页 / 日程 / 名册 / 洞察
│   ├── VoiceFab.jsx                     # 中央语音悬浮按钮
│   └── MobileAuthLayout.jsx             # 登录注册的移动端外壳（100dvh + 安全区）
├── hooks/
│   ├── useAppData.jsx                   # 桌面与手机共用的数据源（Context）
│   └── useVoiceAssistant.js             # 语音结果处理，两端共用
├── styles/mobile.css                    # 安全区、44px 触控区、底部 Sheet 样式
└── pages/
    ├── MobileHomePage/                  # 首页：关系概览 / 今日安排 / 需关注 / 快捷操作
    ├── MobileCalendarPage/              # 日程：关怀列表 + 月历 + 当天 Sheet + 全屏编辑
    ├── MobileDirectoryPage/             # 名册：搜索筛选 + 单列列表
    ├── MobileContactDetailPage/         # 联系人详情 + 互动时间线 + 编辑/删除
    ├── MobileInsightsPage/              # 洞察：按状态分组的关系关怀视图
    ├── MobileAssistantPage/             # 语音助手全屏页（复用 ChatPanel）
    └── MobileSettingsPage/              # 设置：账号、数据概览、退出登录
```

### 阶段 4 交付内容（原生体验）

```text
client/src/native/
├── platform.js        # 平台判断与日志
├── permissions.js     # 麦克风运行时权限
├── notifications.js   # 本地通知：排期 / 取消 / 点击回调
├── appLifecycle.js    # 返回键、前后台切换、appUrlOpen
├── overlays.js        # 浮层关闭器登记（供返回键优先关闭浮层）
├── network.js         # 网络状态与变化监听
└── statusBar.js       # 状态栏样式

client/src/hooks/useNotificationSync.js   # 日程 → 本地通知的同步编排
client/scripts/gen-assets.py              # 生成图标/启动页源图
client/scripts/gen-android-res.py         # 生成各密度 Android 资源
```

#### 麦克风运行时权限

Manifest 里声明 `RECORD_AUDIO` 只代表「允许申请」，真机上不申请就直接
`getUserMedia` 会失败。现在在点录音时先走一次显式申请，失败时给出可操作提示
（引导去系统设置开启）。

#### 本地通知

- 登录后、日程数据变化时、App 回到前台时，都会重新同步；
- 只取未来 7 天、且「提醒时刻尚未过去」的日程；
- 通知 id 由「事件 id + 开始时间」哈希得到，因此重复同步不会产生重复提醒；
  事件改期后 id 变化，旧通知已被统一取消；
- 同步策略是「先取消本 App 全部已排期通知，再按当前数据重建」，保证幂等；
- 点击通知跳到 `#/calendar?eventId=xxx`；
- 退出登录时清除全部通知。

通知正文会判断标题里是否已含联系人姓名，避免出现
「10 分钟后：**和张伟和张伟** 1对1 沟通」这类重复。

#### Android 返回键

严格按方案的四级规则实现，且浮层优先：

```text
1. 有打开的 Drawer / Bottom Sheet / Modal → 先关闭
2. 二级页面（联系人详情 / 设置 / 助手）  → 返回所属 Tab 或首页
3. 非首页的一级 Tab                      → 切回首页
4. 已在首页且无浮层                      → 退出 App
```

「浮层优先」通过 `native/overlays.js` 实现：各页面在浮层打开时登记关闭函数，
Shell 收到返回键时按后进先出询问。

#### 应用图标与启动页

图标沿用 App 内的品牌元素（深色圆角方块 + 白色 TM）。启动页为浅灰蓝底 +
TM 标志 + 应用名 + 副标题，另有夜间模式版本。

> 生成方式说明：方案里提到用 `@capacitor/assets`，但它依赖 `sharp@0.32`，
> 该版本在 Windows + pnpm 10 下需要本地 node-gyp 编译，安装脚本被 pnpm 拦截后无法使用。
> 因此改为用 Pillow 直接产出各密度资源（`scripts/gen-android-res.py`），
> 结果可复现且不引入原生依赖。执行 `pnpm run assets:gen` 可重新生成。

### 架构决策

- **一套状态，两端共用**：`AppDataProvider` 统一持有 events / contacts / heatmap 与
  刷新逻辑，桌面 `MainLayout` 与手机 `MobileShell` 都从它取数，避免两端行为走偏。
- **外壳按运行环境切换**：`Capacitor.isNativePlatform()` 为真时走 `MobileShell`
  路由表，浏览器访问仍走原有桌面双栏工作台。桌面端行为完全不受影响，
  课程演示时可以同时展示两种形态。
- **语音助手不占 Tab**：按方案要求做成底部中央悬浮按钮，在
  `/calendar`（顶栏已有 ＋，且月历需要完整高度）与
  `/assistant`（页面内已有更大的麦克风）两个路由自动隐藏，避免入口打架。
- **原生能力集中在 `src/native/`**：所有 `Capacitor.isNativePlatform()` 判断与
  插件调用都收敛到这一层，页面代码只调用语义化的函数（如
  `ensureMicrophonePermission()`），便于后续替换实现或在 Web 端降级。

### 顺带修掉的两个既有 Bug

1. **月份边界**：原 `refreshEvents` 用 `getMonth()+2` 拼月份，12 月会得到非法的
   `"13"`，导致 12 月查不到日程。已改用 dayjs 计算区间。
2. **日期区间为闭区间**：后端是 `start_time >= ? AND start_time <= ?`，
   而前端只传 `"YYYY-MM-DD"`，会被当成当天 `00:00:00`，
   于是「今天 10:00 的日程」查不出来 —— 首页「今日安排」一开始始终为空就是这个原因。
   现已统一改为传 `"YYYY-MM-DD 00:00:00"`，结束取次日零点。

### 验收结果（Pixel 3a / Android 15 模拟器实测）

**阶段 0 / 1**

```text
✅ APK 安装成功，包名 com.talentmate.app，应用名「TalentMate 伴贤」
✅ 冷启动后页面由 APK 本地资源加载（日志：Loading app at https://localhost）
✅ 无崩溃，MainActivity 正常置于前台
✅ 路由为 https://localhost/#/login —— HashRouter 生效
✅ 页面 → http://49.232.160.212/api/health 返回 200（明文/混合内容放行生效）
✅ 使用真实账户登录成功，JWT 写入 localStorage，跳转到 #/
✅ APK 内仅含前端资源，未打包任何服务端密钥
```

**阶段 2**

```text
✅ 首页：问候语 + 关系概览计数 + 今日安排 + 需要关注的人 + 快捷操作
✅ 底部四 Tab 切换正常，当前 Tab 高亮，二级页面仍高亮所属 Tab
✅ 日程页：关怀列表按日期分组；月历 6 行完整显示、有事件的日期显示圆点
✅ 点击日期弹出当天 Bottom Sheet，展示事件并可直接「添加关怀安排」
✅ 事件卡片的 ⋮ 菜单常显（不依赖 hover），含 编辑 / 预览邮件 / 删除
✅ 名册页：搜索、类型筛选（全部/员工/候选人）、粘贴 CSV 入口
✅ 通过 App 表单成功创建联系人（写入真实后端）
✅ 联系人详情：三个主操作 + 关系状态 + 互动时间线
✅ 洞察页：按状态分组呈现，可点进联系人详情
✅ 助手页：全屏语音助手，快捷指令与录音按钮可用
✅ 设置页：账号、数据概览、退出登录二次确认
✅ 通过 App 创建关联联系人的日程，首页与日程页均正确渲染
✅ WebView 无 JS 报错，logcat 无 FATAL EXCEPTION
```

> 手机端已不再使用桌面双栏布局。登录后进入的是移动端首页，
> 底部为四个一级 Tab，语音助手通过中央悬浮按钮进入。

**阶段 3 收尾（邮件页 + 新手引导）**

```text
✅ 邮件草稿改为全屏页：收件人 / 主题 / 正文，编辑与预览用 Tab 切换
✅ 预览走 sanitizeEmailHtml 净化后再渲染（不再直接 dangerouslySetInnerHTML）
✅ 净化实测 15/15 通过：script / onerror / onclick / javascript: /
   iframe / form / object / onbegin / style 全部被剥离，
   正常 https 链接与表格样式保留，外链自动加 target=_blank + rel=noopener
✅ 有未保存修改时，点返回或按 Android 返回键都会先弹「放弃未保存的修改？」
✅ 「继续编辑」停留原页；「放弃修改」返回日程
✅ 从日程卡片进入可保存草稿；从联系人详情进入明确标注「仅预览」
   （后端草稿以日程为载体，联系人维度没有独立草稿表）
✅ 移动端 3 页新手引导：建立名册 → 查看关系温度 → 用语音安排互动
✅ 引导期间不再弹出通知权限框（此前会在引导上直接叠系统弹窗）
✅ 通知权限改为按需申请：在设置页打开「日程提醒」开关时才申请
✅ 授权后提醒正常排期（pending=1，AlarmManager 有对应 RTC_WAKEUP）
```

**阶段 4（原生体验）**

```text
✅ 通知权限：首次同步时弹出系统授权框，授权后 POST_NOTIFICATIONS=granted
✅ 麦克风权限：RECORD_AUDIO 初始为 denied，点录音时正确发起运行时申请
✅ 本地通知排期：未来 7 天日程按 reminder 生成通知，id 稳定可去重
   实测「4 分钟后开始 / 提前 2 分钟提醒」→ 通知排期正确
✅ 通知真实投递：dumpsys notification 中确认通知已投递，
   正文「2 分钟后：通知触发验证」正确
✅ 通知点击跳转：点击通知后 App 打开并跳到 #/calendar
✅ 通知频道：talentmate-reminders（关怀提醒，importance=4）
✅ 通知权限被拒绝时不残留无效通知
✅ 返回键 - 浮层优先：日程编辑 Drawer 打开时按返回键只关闭抽屉，不离开页面
✅ 返回键 - 二级页面：设置页按返回键 → 回到 #/
✅ 返回键 - 一级 Tab：名册页按返回键 → 回到 #/
✅ 应用图标：APK 内为自适应图标 mipmap-anydpi-v26/ic_launcher.xml，
   桌面抽屉中显示深色 TM 图标与「TalentMate 伴贤」名称
✅ 启动页：各密度 drawable 已生成（竖屏/横屏/通用，共 11 组）
✅ 状态栏：深色图标 + 白色背景，内容不被状态栏遮挡
✅ logcat 无 FATAL EXCEPTION
```

> 已知测试残留：反复 `adb install -r` 会让旧版本排期的闹钟变成无法触发的孤儿记录，
> 表现为 `getPending()` 里还留着早已过期的通知。这只在反复覆盖安装的调试场景出现，
> 全新安装不会遇到；代码里每次同步都会先 `cancel` 全部再重建。

---

## 2. 技术栈与关键决策

```text
React 18 + Vite  →  vite build  →  dist/
                 →  cap sync android  →  android/app/src/main/assets/public
                 →  Gradle  →  APK
```

- **容器**：Capacitor 8.5.2（`@capacitor/core`、`@capacitor/android`、`@capacitor/cli`）
- **包名**：`com.talentmate.app`
- **应用名**：`TalentMate 伴贤`
- **路由**：原生平台使用 `HashRouter`，浏览器开发仍用 `BrowserRouter`
  （原生页面由本地静态资源提供，没有服务端 history fallback，必须用 hash 路由）
- **API 地址**：`VITE_API_URL=http://49.232.160.212`（见 `client/.env.production`）
  所有调用方自带 `/api` 前缀，因此该变量**只写主机名、不要带 `/api`**。

> 当前是 HTTP + IP 的课程开发阶段。正式公开发布前必须迁移到带有效证书的 HTTPS，
> 并同步关闭 `allowMixedContent`、`server.cleartext`、`android:usesCleartextTraffic`。

---

## 3. 本机环境要求

| 组件 | 要求 | 本机实际 |
|---|---|---|
| JDK | **21**（Capacitor 8 生成的 `capacitor.build.gradle` 使用 `JavaVersion.VERSION_21`） | `D:\jdk-21.0.12.1+1` = Temurin 21.0.12.1 LTS ✅ 已安装 |
| Android SDK Platform | **android-36** | 已安装 ✅ |
| Build-Tools | **36.0.0** | 已安装 ✅ |
| Android SDK 路径 | `ANDROID_HOME` | `C:\Users\Sytus\AppData\Local\Android\Sdk` ✅ |
| Gradle | 8.14.3（wrapper 自动下载） | 已配置腾讯云镜像 ✅ |

### ⚠️ 本机 JDK 的三个坑

1. `PATH` 里的 `java` 是 **JDK 8**；
2. `JAVA_HOME` 指向 `D:\jdk-18.0.2.1`（Java 18）；
3. Android Studio 自带的 JBR 是 **JDK 17**。

**三者都无法满足 Capacitor 8 的 Java 21 要求。** 因此已额外安装 Temurin JDK 21
到 `D:\jdk-21.0.12.1+1`。

`client/android/gradle.properties` 中 **默认注释掉** 了 JDK 路径设置（因为每人机器路径不同，
写死会互相破坏）。请在**本机**取消注释并填自己的路径：

```properties
org.gradle.java.home=D:\\jdk-21.0.12.1+1
```

用 Android Studio 打开工程时，也可以在
`Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK`
中选择 `D:\jdk-21.0.12.1+1`（或任意 JDK 21）。

> `client/android/build.gradle` 顶部加入了版本校验：如果 Gradle 跑在低于 21 的 JDK 上，
> 会直接抛出**中文提示**告诉你三种修正方式，而不是让你看到难懂的
> `invalid source release: 21`。
>
> 命令行构建时也可以直接设环境变量：`$env:JAVA_HOME="D:\jdk-21.0.12.1+1"`。

> 另外本机有两套 Android Studio：
> `C:\Users\Sytus\AppData\Local\Android\android-studio`（完整，JBR 17）
> 与 `D:\Android\Android Studio`（**安装不完整**，`jbr\bin` 下没有 `java.exe`）。
> 建议一律使用前者。

### 网络：Gradle 分发与依赖镜像

`services.gradle.org` 在国内下载极慢（实测长时间卡在 0 字节），因此已改为：

- Gradle 分发：`https://mirrors.cloud.tencent.com/gradle/gradle-8.14.3-bin.zip`
- Maven 依赖：阿里云 `maven.aliyun.com` 的 `google` / `central` / `gradle-plugin` 仓库，
  并保留 `google()` 与 `mavenCentral()` 作为兜底。

---

## 4. 中文路径问题（重要）

项目路径含中文：`D:\学习\我爱学习\前端开发\TalentMate`。

Windows 控制台代码页为 932/936 时，`cmd.exe` 会把中文路径转成乱码，导致：

```text
Error: Unable to access jarfile D:\...\gradle\wrapper\gradle-wrapper.jar
```

而且 `java.exe` 从 PowerShell 直接接收中文 `-classpath` 参数时同样会
`ClassNotFoundException: org.gradle.wrapper.GradleWrapperMain`。

**解决方案**：脚本自动建立一个指向 **`client` 目录**的 ASCII 目录联接（junction），
从英文路径调用 Gradle：

```text
C:\tm-client-build  ⟶  D:\学习\我爱学习\前端开发\TalentMate\client
```

> ⚠️ 联接必须指向 `client` 而**不是** `android`。
> 因为 `capacitor.settings.gradle` 用相对路径 `../node_modules/.pnpm/...`
> 引用 `capacitor-android` 模块；如果只联接 `android` 目录，该相对路径会解析到
> `C:\node_modules`，报错：
> `Could not resolve project :capacitor-android ... No variants exist`。

Gradle 的构建产物路径由真实路径解析，因此 APK 仍然输出到
`client/android/app/build/outputs/apk/`，不需要手动复制。

> 如果你想彻底避开这类编码问题，可以把项目移到纯英文路径（例如
> `D:\AndroidProject\TalentMate`）。移动后可直接使用标准的 `gradlew.bat`。

---

## 5. 构建命令

在 `client/` 目录下执行：

### 推荐：使用构建脚本（自动处理 JDK、SDK、中文路径）

```powershell
# Debug APK
powershell -ExecutionPolicy Bypass -File build-android.ps1

# Release APK（需要先配置签名）
powershell -ExecutionPolicy Bypass -File build-android.ps1 -Task assembleRelease

# 只重跑 Gradle，不重新构建前端
powershell -ExecutionPolicy Bypass -File build-android.ps1 -SkipWebBuild
```

### 手动：通过 package.json 脚本

```bash
pnpm run android:sync    # vite build + cap sync android
pnpm run android:apk     # 构建 Debug APK（内部用 gradlew.bat，中文路径下会失败）
pnpm run android:open    # 用 Android Studio 打开 android 工程
pnpm run android:run     # 构建并在已连接设备上运行
pnpm run assets:gen      # 重新生成应用图标与启动页（需 python + Pillow）
```

> **修改 React 代码后必须重新执行 `android:sync`**，否则 APK 里仍是旧的构建结果。

### APK 输出位置

```text
client/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 6. 已修改与新增的文件

| 文件 | 说明 |
|---|---|
| `client/capacitor.config.ts` | 新增。Capacitor 配置（appId、webDir、明文流量、离线页） |
| `client/.env.production` | 新增。`VITE_API_URL=http://49.232.160.212` |
| `client/public/offline.html` | 新增。`server.errorPath` 指向的离线提示页 |
| `client/build-android.ps1` | 新增。一键构建脚本 |
| `client/package.json` | 新增 Capacitor 依赖、typescript、`android:*` 与 `assets:gen` 脚本 |
| `client/src/App.jsx` | 原生平台改用 `HashRouter`，并按环境切换桌面/手机路由表 |
| `client/src/services/api.js` | 401 在原生平台改用 hash 跳转，避免白屏 |
| `client/src/hooks/useAppData.jsx` | 新增。桌面与手机共用的数据源 |
| `client/src/hooks/useVoiceAssistant.js` | 新增。两端共用的语音结果处理 |
| `client/src/hooks/useNotificationSync.js` | 新增。日程 → 本地通知的同步编排 |
| `client/src/layouts/MobileShell.jsx` | 新增。手机外壳（底部导航、悬浮按钮、返回键、状态栏） |
| `client/src/components/Mobile*.jsx`、`VoiceFab.jsx` | 新增。移动端公共组件 |
| `client/src/pages/Mobile*/` | 新增。六个移动端页面 |
| `client/src/pages/HomePage/{eventTypes,heatmap}.js` | 新增。两端共用的类型与状态常量 |
| `client/src/native/` | 新增。原生能力封装（权限/通知/返回键/网络/状态栏） |
| `client/src/styles/mobile.css` | 新增。安全区、触控区、底部 Sheet 样式 |
| `client/scripts/gen-assets.py` | 新增。生成图标与启动页源图 |
| `client/scripts/gen-android-res.py` | 新增。生成各密度 Android 资源 |
| `client/android/` | 新增。Capacitor 生成的 Android 原生工程 |
| `client/android/app/src/main/AndroidManifest.xml` | 开放明文流量，声明麦克风与通知权限 |
| `client/android/app/src/main/res/drawable/ic_stat_icon.xml` | 新增。通知栏单色小图标 |
| `client/android/gradle.properties` | 提升 Gradle 堆内存（JDK 路径改为注释，见 §3） |

---

## 7. 下一步

**已完成**：阶段 0 / 1 / 2 / 3 / 4。

**剩余建议**

1. **阶段 5 稳定性与安全**：接口限流、**服务端**邮件 HTML 净化（前端已做一层，
   但邮件真正发出的那一步仍需在服务端同样净化）、日期与时区统一、日志脱敏、
   数据库业务账户；
2. **真机验证**：模拟器无法替代真机录音（不同厂商的麦克风权限与音频路由差异较大）；
3. **发布（阶段 6）**：Release 签名与 AAB、测试账户、验收清单、演示视频；
4. **HTTPS 迁移**：切换后需同时关闭 `allowMixedContent`、`server.cleartext` 与
   `android:usesCleartextTraffic`。

---

## 8. 验证清单

### 阶段 1
- [x] APK 可安装并启动
- [x] 页面来自 APK 本地资源（`Loading app at https://localhost`）
- [x] 使用测试账户登录成功
- [x] 日程 / 名册 / 洞察列表能拉到真实数据
- [x] 退出登录后回到登录页
- [x] 服务器密钥未出现在 APK 中

### 阶段 2
- [x] 底部四 Tab 可切换且高亮正确
- [x] 六个移动页面均可进入，无 JS 报错
- [x] 通过 App 表单可创建联系人与日程（写入真实后端）
- [x] 操作项常显，不依赖 hover

### 阶段 4
- [x] 麦克风运行时权限弹窗正常
- [x] 通知权限申请与授权状态正确
- [x] 本地通知可真实投递，正文正确
- [x] 点击通知跳到对应日程页
- [x] 返回键：浮层优先 → 二级页面 → 一级 Tab → 退出
- [x] 应用图标与启动页生效
- [x] 状态栏不遮挡内容

### 待真机确认
- [ ] 真机录音（腾讯云 ASR 闭环）
- [ ] 通知在厂商 ROM 后台限制下的存活情况
- [ ] 刘海屏 / 手势导航的安全区表现

### 临时测试账户

验证时通过 App 注册页创建了账户 `apkverify01`（服务器 userId = 4）。
后端**没有**提供删除账户的接口（`server/routes/auth.js` 只有
`/register`、`/login`、`/complete-tour`），并且 MySQL 只在内网暴露，
无法从本机直接清理。如需删除，请在腾讯云服务器上执行：

```bash
docker compose exec mysql mysql -uroot -p voice_calendar \
  -e "DELETE FROM users WHERE username='apkverify01';"
```

（`events` / `contacts` / `interaction_logs` 均为 `ON DELETE CASCADE`，会一并清理。）
