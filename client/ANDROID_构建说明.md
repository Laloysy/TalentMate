# TalentMate Android 构建说明（Capacitor）

> 本文档记录已完成的 Android 接入工作、本机环境要求，以及每个阶段的构建命令。
> 完整改造方案见项目根目录 `TalentMate_Android_Capacitor完整改造方案.md`。

---

## 1. 当前完成状态

已完成方案中的 **阶段 0（基线确认）** 与 **阶段 1（Capacitor Android 跑通）**：

| 项目 | 状态 |
|---|---|
| Web 项目可构建（`vite build` → `dist/`） | ✅ |
| Capacitor 依赖与配置 | ✅ |
| Android 原生工程（`client/android/`） | ✅ |
| 静态资源打包进 APK（非远程加载网页） | ✅ |
| API 指向 `http://49.232.160.212` | ✅ |
| Android 明文流量放行（当前 HTTP 阶段） | ✅ |
| 麦克风 / 通知权限声明 | ✅ 仅声明 |
| 生成 Debug APK | ✅ `app-debug.apk`，4.3 MB |
| 真机/模拟器验证：安装、启动、登录、跳转 | ✅ 见下方"验收结果" |

尚未开始（方案阶段 2 之后）：移动端底部导航与 `MobileShell`、逐页移动化改版、
运行时权限、本地通知、图标与启动页、Release 签名。

### 验收结果（Pixel 3a / Android 15 模拟器实测）

```text
✅ APK 安装成功，包名 com.talentmate.app，应用名「TalentMate 伴贤」
✅ 冷启动后页面由 APK 本地资源加载（日志：Loading app at https://localhost）
✅ 无崩溃，MainActivity 正常置于前台
✅ 路由为 https://localhost/#/login —— HashRouter 生效
✅ 页面 → http://49.232.160.212/api/health 返回 200（明文/混合内容放行生效）
✅ 使用真实账户登录成功，JWT 写入 localStorage，跳转到 #/
✅ 工作台渲染日历、名册、时间线、关怀热力图与语音助手
✅ APK 内仅含前端资源，未打包任何服务端密钥
```

> 说明：当前工作台仍是**桌面双栏布局**，在手机上文字偏小、右侧语音助手为固定宽度，
> 需要方案阶段 2–3 的移动化改版。这就是下一阶段的主要工作。

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
| `client/package.json` | 新增 Capacitor 依赖、typescript，以及 `android:*` 脚本 |
| `client/src/App.jsx` | 原生平台改用 `HashRouter` |
| `client/src/services/api.js` | 401 在原生平台改用 hash 跳转，避免白屏 |
| `client/android/` | 新增。Capacitor 生成的 Android 原生工程 |
| `client/android/app/src/main/AndroidManifest.xml` | 开放明文流量，声明麦克风与通知权限 |
| `client/android/gradle.properties` | 指定 JDK 17、提升 Gradle 堆内存 |

---

## 7. 下一步（方案阶段 2 起）

1. **移动端导航**：`MobileShell`、底部导航、语音助手改 Bottom Sheet；
2. **逐页改版**：登录注册、日程列表与月历、名册、联系人详情、洞察、
   语音助手、邮件编辑、新手引导；
3. **原生体验**：`getUserMedia` 录音的运行时权限、`@capacitor/local-notifications`
   本地通知、返回键处理、状态栏与安全区、应用图标与启动页；
4. **稳定性与安全**：接口限流、邮件 HTML 净化、时区统一、日志脱敏；
5. **发布**：Release 签名、AAB、验收清单、演示视频。

---

## 8. 验证清单（阶段 1 验收）

- [x] APK 可安装并启动
- [x] 页面来自 APK 本地资源（`Loading app at https://localhost`）
- [x] 使用测试账户登录成功
- [x] 日程 / 名册 / 洞察列表能拉到真实数据
- [x] 退出登录后回到登录页
- [ ] 返回键不会白屏（需阶段 4 处理返回键逻辑）
- [x] 服务器密钥未出现在 APK 中

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
