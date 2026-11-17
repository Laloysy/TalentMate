/**
 * 测试报告缺陷的回归验证（界面部分，跑在真实 APK 的 WebView 里）。
 *
 * 前置：
 *   1. 本地后端已启动（默认 http://127.0.0.1:3011）
 *   2. 模拟器已安装并运行本项目的 debug APK
 *   3. adb forward tcp:9444 localabstract:webview_devtools_remote_<pid>
 *
 * 覆盖：
 *   BUG-001  首页「新建日程」应直接打开新建表单
 *   BUG-002  日程卡片更多菜单不被裁切，邮件草稿入口可点
 *   BUG-005  时间选择改为原生控件（可滚动）
 *   BUG-006  邮箱必填标识与校验
 *   BUG-007  双击保存只落一条联系人
 *   BUG-008  删除联系人后日程立即刷新
 *   BUG-004  提醒开关关闭后重进页面保持关闭
 *   TC-075   未保存修改离开时应确认
 */
import process from 'node:process';

const CDP_PORT = Number(process.env.CDP_PORT || 9444);
const API_BASE = process.env.QA_BASE || 'http://127.0.0.1:3011';

let pass = 0;
let fail = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? `  -> ${detail}` : ''}`); }
}

// ---------------------------------------------------------------- CDP 客户端
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      const p = this.pending.get(m.id);
      if (p) { this.pending.delete(m.id); p(m); }
    });
  }

  static async connect() {
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (!page) throw new Error('找不到 WebView page target');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('WebSocket 连接失败')), { once: true });
    });
    return new CDP(ws);
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`CDP ${method} 超时`)), 30000);
      this.pending.set(id, (m) => { clearTimeout(timer); resolve(m); });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const m = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true,
    });
    const r = m.result;
    if (r?.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || 'JS 异常');
    }
    return r?.result?.value;
  }

  close() {
    try { this.ws.close(); } catch { /* ignore */ }
  }

  async waitFor(expr, { timeout = 6000, interval = 200 } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await this.eval(`(() => { try { return !!(${expr}); } catch (e) { return false; } })()`)) return true;
      await this.eval('new Promise(r => setTimeout(r, 150))');
      void interval;
    }
    return false;
  }
}

// ---------------------------------------------------------------- 测试账号与数据
const stamp = Date.now();
const username = `qa_ui_${stamp}`;
const password = 'qa123456';
const email = `${username}@example.com`;

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(`${API_BASE}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: resp.status, json: await resp.json().catch(() => null) };
}

const reg = await api('/api/auth/register', {
  method: 'POST', body: { username, email, password },
});
if (!reg.json?.success) { console.error('注册失败', reg.status, reg.json); process.exit(2); }
const token = reg.json.data.token;

// 夹具：一个带日程的联系人（BUG-002 / BUG-008 用）
const contactEmail = `ui_contact_${stamp}@example.com`;
const cRes = await api('/api/contacts', {
  method: 'POST', token, body: { name: 'QA界面联系人', email: contactEmail, department: 'QA部', role: '测试' },
});
const contactId = cRes.json?.data?.id;
await api('/api/events', {
  method: 'POST', token,
  // 日期必须落在"当前自然月"，日程页只加载选中月份的日程
  body: { title: 'QA界面日程', startTime: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-20 15:00`, reminder: 0, contactId },
});

// ---------------------------------------------------------------- 登录进 App
const cdp = await CDP.connect();

await cdp.eval(`(() => {
  localStorage.setItem('token', ${JSON.stringify(token)});
  localStorage.setItem('username', ${JSON.stringify(username)});
  localStorage.setItem('has_seen_tour', '1');
  localStorage.removeItem('tm_reminder_enabled');
  location.hash = '#/';
  location.reload();
  return true;
})()`);
await cdp.eval('new Promise(r => setTimeout(r, 2500))');

// 页面内通用小工具
const HELPERS = `window.__qa = {
  byText(text, sel) {
    return [...document.querySelectorAll(sel || 'button,a,div,span')]
      .find(el => (el.textContent || '').trim() === text);
  },
  contains(text, sel) {
    // 默认不限于 button：标题是 h1，确认框文案在 div 里
    return [...document.querySelectorAll(sel || 'button,a,h1,h2,h3,label,div,span')]
      .find(el => (el.textContent || '').includes(text));
  },
  byRegex(re, sel) {
    const rx = new RegExp(re);
    return [...document.querySelectorAll(sel || 'button')]
      .find(el => rx.test((el.textContent || '').replace(/\s/g, '')));
  },
  click(el) {
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  },
  setInput(el, v) {
    if (!el) return false;
    const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    d.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  },
  vis(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  },
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}; true;`;
await cdp.eval(HELPERS);

const loggedIn = await cdp.waitFor("document.querySelector('.mobile-bottom-nav')", { timeout: 8000 });
ok('登录并进入主界面', loggedIn);

// ---------------------------------------------------------------- BUG-001
console.log('\n[BUG-001] 首页「新建日程」直接打开表单');
await cdp.eval("location.hash = '#/'; true;");
await cdp.eval('new Promise(r => setTimeout(r, 600))');
await cdp.eval("__qa.click(__qa.contains('新建日程', 'button')); true;");
// 注意：打开表单后页面会用 setSearchParams 把 query 清掉，hash 会变回 #/calendar，
// 所以这里只断言"进入了日程页"，是否真的开了表单看下面的抽屉断言。
await cdp.eval('new Promise(r => setTimeout(r, 1200))');
const hashAfter = await cdp.eval('location.hash');
ok('点击后进入日程页', /#\/calendar/.test(hashAfter), `hash=${hashAfter}`);
const editorOpened = await cdp.waitFor(
  "document.querySelector('.ant-drawer-open') && document.querySelectorAll('input[type=time]').length >= 2",
  { timeout: 6000 },
);
ok('新建表单自动打开（无需再点一次＋）', editorOpened);

// ---------------------------------------------------------------- BUG-005
console.log('\n[BUG-005] 时间选择器可用（原生控件）');
const timeInfo = await cdp.eval(`(() => {
  const els = [...document.querySelectorAll('input[type=time]')];
  return { count: els.length, types: els.map(e => e.type) };
})()`);
ok('开始/结束时间都是原生 input[type=time]', timeInfo?.count >= 2, `count=${timeInfo?.count}`);
ok('不再使用会被 WebView 卡死的滚轮面板',
  await cdp.eval("document.querySelectorAll('.ant-picker-time-panel').length === 0"));

// 用原生控件写入时间，保存后回读，确认真的写进去了
const savedTime = await cdp.eval(`(async () => {
  const inputs = [...document.querySelectorAll('input[type=time]')];
  const titleInput = [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes('和张伟'));
  if (inputs.length < 2 || !titleInput) return { err: 'miss', n: inputs.length, hasTitle: !!titleInput };
  __qa.setInput(inputs[0], '09:30');
  __qa.setInput(inputs[1], '10:15');
  __qa.setInput(titleInput, 'QA 时间控件回归');
  await __qa.sleep(400);
  const btn = __qa.contains('保存', 'button');
  if (!btn) return { err: 'no-save-button' };
  btn.click();
  await __qa.sleep(2200);
  return {
    filled: [inputs[0].value, inputs[1].value, titleInput.value],
    drawerOpen: !!document.querySelector('.ant-drawer-open'),
    errors: [...document.querySelectorAll('.ant-form-item-explain-error')].map(e => e.textContent),
  };
})()`);
ok('时间与标题已填入表单', Array.isArray(savedTime?.filled) && savedTime.filled[0] === '09:30',
  JSON.stringify(savedTime).slice(0, 160));
const _now = new Date();
const _ym = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
const _next = new Date(_now.getFullYear(), _now.getMonth() + 1, 1);
const _nextStr = `${_next.getFullYear()}-${String(_next.getMonth() + 1).padStart(2, '0')}-01`;
const evList = await api(`/api/events?startDate=${_ym}-01 00:00:00&endDate=${_nextStr} 00:00:00`, { token });
const savedEv = (evList.json?.data || []).find((e) => e.title === 'QA 时间控件回归');
ok('原生时间控件写入的值被正确保存', !!savedEv && String(savedEv.start_time).includes('09:30'),
  `start_time=${savedEv?.start_time}`);

// ---------------------------------------------------------------- BUG-002
console.log('\n[BUG-002] 更多菜单不被裁切');
await cdp.eval("location.hash = '#/calendar'; true;");
await cdp.eval('new Promise(r => setTimeout(r, 900))');
const menuBefore = await cdp.eval(`(() => {
  const cards = [...document.querySelectorAll('div')].filter(d => d.textContent.includes('QA界面日程'));
  return { hasCard: cards.length > 0 };
})()`);
ok('日历列表里有夹具日程', menuBefore?.hasCard);

// 必须点到"夹具那张卡片"的菜单：BUG-005 也会新建一条无联系人的日程，
// 它在列表里排更前，点第一个「更多」会拿到没有「邮件草稿」的菜单。
const openedOnFixture = await cdp.eval(`(() => {
  const titleEl = [...document.querySelectorAll('h4')].find(h => h.textContent.includes('QA界面日程'));
  if (!titleEl) return { ok: false, reason: 'no-title' };
  const card = titleEl.closest('div[style*="border-left"]') || titleEl.closest('div');
  const btn = card?.querySelector('button[aria-label="更多操作"]');
  if (!btn) return { ok: false, reason: 'no-menu-button' };
  btn.click();
  return { ok: true };
})()`);
ok('打开了夹具日程的更多菜单', openedOnFixture?.ok, JSON.stringify(openedOnFixture));
await cdp.eval('new Promise(r => setTimeout(r, 600))');
const menuState = await cdp.eval(`(() => {
  const menus = [...document.querySelectorAll('.ant-dropdown')].filter(m => m.offsetParent !== null);
  if (!menus.length) return { open: false };
  const m = menus[menus.length - 1];
  const r = m.getBoundingClientRect();
  const inViewport = r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
  const host = m.closest('.ant-drawer-body, .ant-card') ? 'clipped-parent' : 'body-portal';
  const text = m.textContent || '';
  return { open: true, inViewport, host, hasMail: text.includes('邮件草稿'), rect: [r.left, r.top, r.right, r.bottom] };
})()`);
ok('菜单已弹出', menuState?.open);
ok('菜单渲染在 body 的 portal 里（不受父容器 overflow 裁切）', menuState?.host === 'body-portal', `host=${menuState?.host}`);
ok('菜单完整显示在屏幕内', menuState?.inViewport, JSON.stringify(menuState?.rect));
ok('「邮件草稿」入口存在（TC-093 曾因此 BLOCKED）', menuState?.hasMail);

await cdp.eval(`(() => {
  const item = [...document.querySelectorAll('.ant-dropdown-menu-title-content')].find(el => el.textContent.includes('邮件草稿'));
  __qa.click(item);
  return true;
})()`);
await cdp.eval('new Promise(r => setTimeout(r, 800))');
const mailHash = await cdp.eval('location.hash');
ok('点击「邮件草稿」能进入邮件页', /#\/mail\//.test(mailHash), `hash=${mailHash}`);

// ---------------------------------------------------------------- TC-075
console.log('\n[TC-075] 未保存修改离开确认');
await cdp.eval("location.hash = '#/calendar?action=new'; true;");
await cdp.eval('new Promise(r => setTimeout(r, 900))');
const dirty = await cdp.eval(`(async () => {
  const titleInput = [...document.querySelectorAll('input[type=text]')].find(i => i.placeholder && i.placeholder.includes('和张伟'));
  if (!titleInput) return { ok: false, reason: 'no-title-input' };
  __qa.setInput(titleInput, '改了一半就退出');
  await __qa.sleep(300);
  __qa.click(document.querySelector('button[aria-label="返回"]'));
  await __qa.sleep(700);
  const modal = [...document.querySelectorAll('.ant-modal')].find(m => m.offsetParent !== null);
  return { ok: true, hasModal: !!modal, text: modal ? modal.textContent : '' };
})()`);
ok('修改后返回会弹出确认框', dirty?.hasModal, JSON.stringify(dirty).slice(0, 120));
ok('确认框文案为「放弃未保存的修改？」', (dirty?.text || '').includes('放弃未保存的修改'));

await cdp.eval(`(() => {
  const btn = __qa.contains('继续编辑', '.ant-modal button');
  if (!btn) return false;
  btn.click();
  return true;
})()`);
await cdp.eval('new Promise(r => setTimeout(r, 1200))');
const stillOpen = await cdp.eval(`(() => ({
  drawer: !!document.querySelector('.ant-drawer-open'),
  modal: !!document.querySelector('.ant-modal-confirm'),
}))()`);
ok('选择「继续编辑」后仍留在表单', stillOpen?.drawer === true && stillOpen?.modal === false,
  JSON.stringify(stillOpen));

await cdp.eval(`(() => {
  __qa.click(document.querySelector('button[aria-label="返回"]'));
  return true;
})()`);
await cdp.eval('new Promise(r => setTimeout(r, 600))');
await cdp.eval(`(() => {
  __qa.click(__qa.contains('放弃修改', '.ant-modal button'));
  return true;
})()`);
await cdp.eval('new Promise(r => setTimeout(r, 700))');
const closed = await cdp.eval("!document.querySelector('.ant-drawer-open')");
ok('选择「放弃修改」后表单关闭', closed);

// ---------------------------------------------------------------- BUG-006 / BUG-007
console.log('\n[BUG-006] 邮箱必填标识');
await cdp.eval("location.hash = '#/contacts'; true;");
await cdp.eval('new Promise(r => setTimeout(r, 900))');
await cdp.eval("__qa.click(document.querySelector('button[aria-label=\"添加联系人\"]')); true;");
await cdp.eval('new Promise(r => setTimeout(r, 800))');
const emailRequired = await cdp.eval(`(() => {
  const items = [...document.querySelectorAll('.ant-form-item')];
  const item = items.find(it => (it.querySelector('label')?.textContent || '').replace(/\\s|\\*/g,'') === '邮箱');
  if (!item) return { found: false };
  const label = item.querySelector('label');
  // antd v5 把必填样式加在 <label> 上，不是 form-item 容器
  return {
    found: true,
    required: !!label && label.classList.contains('ant-form-item-required'),
    labelClass: label ? label.className : '',
  };
})()`);
ok('邮箱字段已标记为必填', emailRequired?.found && emailRequired?.required, JSON.stringify(emailRequired));

await cdp.eval("__qa.click(__qa.contains('保存', 'button')); true;");
await cdp.eval('new Promise(r => setTimeout(r, 800))');
const validationMsg = await cdp.eval(`(() => {
  const els = [...document.querySelectorAll('.ant-form-item-explain-error')];
  return els.map(e => e.textContent);
})()`);
ok('空表单提交时提示邮箱必填', (validationMsg || []).some(t => t.includes('请输入邮箱')), JSON.stringify(validationMsg));

console.log('\n[BUG-007] 双击保存只创建一条');
const doubleClick = await cdp.eval(`(async () => {
  const nameInput = [...document.querySelectorAll('.ant-form-item')]
    .find(it => (it.querySelector('label')?.textContent || '').replace(/\\s|\\*/g,'') === '姓名')
    ?.querySelector('input');
  const mailInput = [...document.querySelectorAll('.ant-form-item')]
    .find(it => (it.querySelector('label')?.textContent || '').replace(/\\s|\\*/g,'') === '邮箱')
    ?.querySelector('input');
  __qa.setInput(nameInput, 'QA双击测试');
  __qa.setInput(mailInput, ${JSON.stringify(`dbl_${stamp}@example.com`)});
  await __qa.sleep(300);
  const btn = __qa.contains('保存', 'button');
  // 同一 tick 连点两次，模拟快速双击
  __qa.click(btn);
  __qa.click(btn);
  await __qa.sleep(2200);
  return true;
})()`);
void doubleClick;
const dblList = await api('/api/contacts', { token });
const dblCount = (dblList.json?.data || []).filter((c) => c.email === `dbl_${stamp}@example.com`).length;
ok('双击保存只写入 1 条联系人', dblCount === 1, `实际=${dblCount} 条`);

// 关掉新增抽屉
await cdp.eval(`(() => { const b = document.querySelector('button[aria-label="返回"]'); __qa.click(b); return true; })()`);
await cdp.eval('new Promise(r => setTimeout(r, 700))');

// ---------------------------------------------------------------- BUG-008
console.log('\n[BUG-008] 删除联系人后日程即时刷新');
await cdp.eval("location.hash = '#/calendar'; true;");
await cdp.eval('new Promise(r => setTimeout(r, 1000))');
const beforeDel = await cdp.eval("document.body.textContent.includes('QA界面联系人')");
ok('删除前日程卡片显示联系人姓名', beforeDel);

await cdp.eval(`location.hash = '#/contacts/${contactId}'; true;`);
await cdp.eval('new Promise(r => setTimeout(r, 1200))');
await cdp.eval(`(() => {
  __qa.click(document.querySelector('button[aria-label="删除联系人"]'));
  return true;
})()`);

// Popconfirm 的「删除」按钮会被 antd 插入空格（渲染成「删 除」），
// 而且弹层是动画渐入的，必须轮询等到按钮可见再点，否则点击落空。
let confirmClicked = { found: false };
for (let i = 0; i < 15 && !confirmClicked.found; i += 1) {
  confirmClicked = await cdp.eval(`(() => {
    const btns = [...document.querySelectorAll('.ant-popover button')].filter(b => b.offsetParent !== null);
    const okBtn = btns.find(b => (b.textContent || '').replace(/\\s/g, '') === '删除');
    if (!okBtn) return { found: false, texts: btns.map(b => b.textContent) };
    okBtn.click();
    return { found: true };
  })()`);
  if (!confirmClicked.found) await cdp.eval('new Promise(r => setTimeout(r, 200))');
}
ok('确认删除弹层可点击', confirmClicked.found, JSON.stringify(confirmClicked).slice(0, 120));
await cdp.eval('new Promise(r => setTimeout(r, 2200))');

const delState = await api('/api/contacts', { token });
const stillExists = (delState.json?.data || []).some((c) => c.id === contactId);
ok('联系人已从服务端删除', !stillExists);

await cdp.eval("location.hash = '#/calendar'; true;");
await cdp.eval('new Promise(r => setTimeout(r, 1200))');
const afterDel = await cdp.eval(`(() => ({
  stillHasName: document.body.textContent.includes('QA界面联系人'),
  hasEvent: document.body.textContent.includes('QA界面日程'),
}))()`);
ok('日程本身保留', afterDel?.hasEvent);
ok('旧联系人姓名不再出现（无需重启 App）', afterDel?.stillHasName === false);

// ---------------------------------------------------------------- BUG-004
console.log('\n[BUG-004] 提醒开关关闭后保持关闭');
await cdp.eval("location.hash = '#/settings'; true;");
await cdp.eval('new Promise(r => setTimeout(r, 1200))');
const sw0 = await cdp.eval(`(() => {
  const sw = document.querySelector('.ant-switch');
  return { exists: !!sw, checked: sw?.getAttribute('aria-checked') };
})()`);
ok('设置页有「日程提醒」开关', sw0?.exists, JSON.stringify(sw0));

// 关闭
await cdp.eval("__qa.click(document.querySelector('.ant-switch')); true;");
await cdp.eval('new Promise(r => setTimeout(r, 1200))');
const afterOff = await cdp.eval(`(() => ({
  checked: document.querySelector('.ant-switch')?.getAttribute('aria-checked'),
  pref: localStorage.getItem('tm_reminder_enabled'),
}))()`);
ok('关闭后开关为关', afterOff?.checked === 'false', JSON.stringify(afterOff));
ok('关闭状态已持久化', afterOff?.pref === '0');

// 离开再回来
await cdp.eval("location.hash = '#/'; true;");
await cdp.eval('new Promise(r => setTimeout(r, 800))');
await cdp.eval("location.hash = '#/settings'; true;");
await cdp.eval('new Promise(r => setTimeout(r, 1400))');
const afterReenter = await cdp.eval(`(() => ({
  checked: document.querySelector('.ant-switch')?.getAttribute('aria-checked'),
  pref: localStorage.getItem('tm_reminder_enabled'),
}))()`);
ok('重进设置页后开关仍为关（核心修复）', afterReenter?.checked === 'false', JSON.stringify(afterReenter));

// 恢复开启，避免影响后续手工测试
await cdp.eval("__qa.click(document.querySelector('.ant-switch')); true;");
await cdp.eval('new Promise(r => setTimeout(r, 1200))');

// ---------------------------------------------------------------- 汇总
console.log(`\n===== 界面回归结果: ${pass} 通过 / ${fail} 失败 =====`);
if (fail) console.log('失败项:', failures.join(', '));
cdp.close();
// WebSocket 关闭是异步的，这里显式退出，避免脚本跑完后进程挂住
process.exit(fail ? 1 : 0);
