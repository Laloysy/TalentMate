# 测试脚本

对应改造方案 §23「测试方案」与 §28「最低验收清单」。
这些脚本打的是**真实生产后端**（`http://49.232.160.212`），不是 mock。

---

## 1. `api-test.mjs` — 生产 API 测试

覆盖方案 §23.1 与 §23.6 中可在接口层验证的部分：

- 未登录不能访问业务 API（含伪造 JWT）
- 注册 / 登录 / 重复用户名 / 错误密码
- 非法输入：缺字段、超长标题、错误时间格式、提醒超范围
- 语音接口缺音频、伪造音频被拒
- **跨用户数据隔离**：B 用户读不到 / 改不了 / 删不掉 A 的数据
- 邮件预览的 HTML 转义（脚本与事件属性不落地）
- 登录限流生效（20 次失败 / 15 分钟）

```bash
node tests/api-test.mjs
```

> 会在生产库创建 `e2e_a_*` / `e2e_b_*` 测试账户，跑完请清理：
> ```sql
> -- 先删依赖行（否则触发外键 1452）
> DELETE l FROM interaction_logs l JOIN users u ON u.id=l.user_id
>   WHERE u.username LIKE 'e2e\_%';
> DELETE FROM users WHERE username LIKE 'e2e\_%';
> ```

---

## 2. `ui-test.mjs` — APK 界面与布局测试

在真实运行的 App WebView 内执行（通过 CDP），覆盖：

- 底部四个 Tab 渲染完整 + 高亮正确
- 无横向滚动、底部导航不溢出、触控目标 ≥ 40px
- 语音悬浮按钮的显示/隐藏规则（`/calendar`、`/assistant` 隐藏）
- 联系人详情页与编辑浮层
- WebView 内无未捕获 JS 错误

```bash
# 1) 启动模拟器并安装 APK（需临时打开 webContentsDebuggingEnabled）
# 2) 转发调试端口：
adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.talentmate.app)
# 3) 运行
node tests/ui-test.mjs
```

---

## 3. `cdp.mjs` — 在 App 内执行任意 JS

调试与手工验证的通用工具（`ui-test.mjs` 内部也用它）。

```bash
node tests/cdp.mjs "location.hash"
node tests/cdp.mjs --file some-script.js     # 多行脚本用文件，避免 PowerShell 传参问题
```

---

## 4. 需要在真机上验证的部分

模拟器无法覆盖，以下项**尚未验证**：

| 项目 | 原因 |
|---|---|
| 真机录音 + 腾讯云 ASR 闭环 | 模拟器的 `audioinput` 是无设备的占位设备，`getUserMedia` 拿不到流 |
| 厂商 ROM 的后台通知存活 | 需要真机的省电策略表现 |
| 刘海 / 水滴屏 / 手势导航安全区 | 需要真机屏幕形态 |
| 移动网络与弱网 | 模拟器只有 Wi-Fi |
| 键盘遮挡输入框 | 需要真机输入法 |

其中**真机录音最关键** —— 语音是本项目的核心链路，模拟器完全无法替代。
