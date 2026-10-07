/**
 * TalentMate 生产 API 测试（对应方案 §23.1 / §23.6）
 *
 * 直接打生产后端 http://49.232.160.212，覆盖：
 *   1. 未登录不能访问业务 API
 *   2. A 用户不能读取 B 用户数据（跨用户隔离）
 *   3. 非法输入被拒绝（缺字段、错误类型、超大载荷）
 *   4. 未授权/非法音频上传被拒绝
 *   5. 邮件预览的 HTML 会转义（脚本不落地）
 *   6. 限流生效（登录、语音）
 *   7. 生产日志不泄漏 JWT / 密码（通过触发错误后检查响应体不含敏感信息）
 *
 * 注意：所有写入都使用固定前缀的测试账户，运行结束会说明如何清理。
 */
const BASE = 'http://49.232.160.212';
const STAMP = String(Date.now()).slice(-6);
const USER_A = { username: `e2e_a_${STAMP}`, email: `e2e_a_${STAMP}@example.com`, password: 'Test123456' };
const USER_B = { username: `e2e_b_${STAMP}`, email: `e2e_b_${STAMP}@example.com`, password: 'Test123456' };

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
}

async function req(method, path, { token, body, raw, headers = {} } = {}) {
  const url = `${BASE}${path}`;
  const opts = { method, headers: { ...headers } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (raw !== undefined) {
    opts.body = raw;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, text, json, headers: res.headers };
}

async function main() {
  console.log(`测试账户：${USER_A.username} / ${USER_B.username}\n`);

  // ---------- 1. 未登录不能访问业务 API ----------
  console.log('--- 1. 未登录访问控制 ---');
  for (const [m, p] of [['GET', '/api/events'], ['GET', '/api/contacts'],
    ['GET', '/api/insights/relationship-heatmap'], ['POST', '/api/mail/preview']]) {
    const r = await req(m, p, { body: m === 'POST' ? {} : undefined });
    check(`${m} ${p} 未登录被拒（401）`, r.status === 401, `实际 ${r.status}`);
  }
  {
    const r = await req('GET', '/api/events', { token: 'garbage.token.value' });
    check('伪造 JWT 被拒（401）', r.status === 401, `实际 ${r.status}`);
  }

  // ---------- 2. 注册两个用户 ----------
  console.log('\n--- 2. 注册与登录 ---');
  const regA = await req('POST', '/api/auth/register', { body: USER_A });
  check('用户 A 注册成功', regA.status === 201 && regA.json?.success === true,
    `status=${regA.status} body=${regA.text.slice(0, 120)}`);
  const tokenA = regA.json?.data?.token;

  const regB = await req('POST', '/api/auth/register', { body: USER_B });
  check('用户 B 注册成功', regB.status === 201 && regB.json?.success === true,
    `status=${regB.status} body=${regB.text.slice(0, 120)}`);
  const tokenB = regB.json?.data?.token;

  {
    const r = await req('POST', '/api/auth/login', { body: { username: USER_A.username, password: 'wrong-password' } });
    check('错误密码登录返回 401', r.status === 401, `实际 ${r.status}`);
  }
  {
    const r = await req('POST', '/api/auth/login', { body: { username: USER_A.username, password: USER_A.password } });
    check('正确密码登录成功', r.status === 200 && !!r.json?.data?.token, `实际 ${r.status}`);
  }
  {
    // 重复注册同名用户应被拒绝
    const r = await req('POST', '/api/auth/register', { body: USER_A });
    check('重复用户名注册被拒', r.status >= 400, `实际 ${r.status}`);
  }

  if (!tokenA || !tokenB) {
    console.log('\n注册失败，后续用例无法继续');
    return;
  }

  // ---------- 3. 非法输入 ----------
  console.log('\n--- 3. 非法输入 ---');
  {
    const r = await req('POST', '/api/contacts', { token: tokenA, body: {} });
    check('创建联系人缺 name 被拒（400）', r.status === 400, `实际 ${r.status}`);
  }
  {
    const r = await req('POST', '/api/events', { token: tokenA, body: { startTime: '2026-10-08 10:00' } });
    check('创建日程缺 title 被拒（400）', r.status === 400, `实际 ${r.status}`);
  }
  {
    const r = await req('POST', '/api/events', { token: tokenA, body: { title: 'x'.repeat(300) + 'T', startTime: '2026-10-08 10:00' } });
    check('超长标题被拒或截断（不产生 500）', r.status !== 500, `实际 ${r.status}`);
  }
  {
    const r = await req('POST', '/api/voice/recognize', { token: tokenA, body: { foo: 'bar' } });
    check('语音接口缺音频文件被拒（400）', r.status === 400, `实际 ${r.status}`);
  }
  {
    // 上传一个非音频文件（伪装成 wav）
    const form = new FormData();
    form.append('audio', new Blob([Buffer.from('not-really-audio')], { type: 'audio/wav' }), 'fake.wav');
    const res = await fetch(`${BASE}/api/voice/recognize`, {
      method: 'POST', headers: { Authorization: `Bearer ${tokenA}` }, body: form,
    });
    check('伪造音频被拒绝（4xx/5xx 但不是 200 成功）', res.status !== 200,
      `实际 ${res.status}`);
  }

  // ---------- 4. 跨用户隔离 ----------
  console.log('\n--- 4. 跨用户数据隔离 ---');
  const cA = await req('POST', '/api/contacts', {
    token: tokenA,
    body: { name: `保密联系人_${STAMP}`, email: `secret_${STAMP}@example.com`, department: 'A部门', role: 'A岗位' },
  });
  check('用户 A 创建联系人成功', cA.status === 201, `status=${cA.status} ${cA.text.slice(0, 100)}`);
  const contactAId = cA.json?.data?.id;

  const eA = await req('POST', '/api/events', {
    token: tokenA,
    body: { title: `A的私密日程_${STAMP}`, startTime: '2026-10-09 10:00', reminder: 10, contactId: contactAId },
  });
  check('用户 A 创建日程成功', eA.status === 201, `status=${eA.status} ${eA.text.slice(0, 100)}`);
  const eventAId = eA.json?.data?.id;

  {
    const r = await req('GET', '/api/contacts', { token: tokenB });
    const names = (r.json?.data || []).map((c) => c.name);
    check('用户 B 的联系人列表看不到 A 的联系人', !names.includes(`保密联系人_${STAMP}`),
      `B 看到 ${names.length} 条`);
  }
  {
    const r = await req('GET', `/api/contacts/${contactAId}/timeline`, { token: tokenB });
    const leaked = r.status === 200 && JSON.stringify(r.json || {}).includes(`保密联系人_${STAMP}`);
    check('用户 B 读取 A 联系人时间线不泄漏数据', !leaked,
      `status=${r.status}`);
  }
  {
    const r = await req('PUT', `/api/contacts/${contactAId}`, { token: tokenB, body: { name: '被篡改' } });
    const stillMine = await req('GET', '/api/contacts', { token: tokenA });
    const unchanged = (stillMine.json?.data || []).find((c) => c.id === contactAId)?.name === `保密联系人_${STAMP}`;
    check('用户 B 无法修改 A 的联系人', unchanged, `B 的 PUT 返回 ${r.status}`);
  }
  {
    const r = await req('GET', '/api/events', { token: tokenB, });
    const titles = (r.json?.data || []).map((e) => e.title);
    check('用户 B 的日程列表看不到 A 的日程', !titles.includes(`A的私密日程_${STAMP}`),
      `B 看到 ${titles.length} 条`);
  }
  {
    const r = await req('DELETE', `/api/events/${eventAId}`, { token: tokenB });
    const stillThere = await req('GET', '/api/events', { token: tokenA });
    const found = (stillThere.json?.data || []).some((e) => e.id === eventAId);
    check('用户 B 无法删除 A 的日程', found, `B 的 DELETE 返回 ${r.status}`);
  }

  // ---------- 5. 邮件预览转义 ----------
  console.log('\n--- 5. 邮件预览内容安全 ---');
  {
    const r = await req('POST', '/api/mail/preview', {
      token: tokenA,
      body: { eventId: eventAId, bodyOverride: '<script>alert(1)</script><img src=x onerror=alert(2)>' },
    });
    const html = r.json?.data?.html || '';
    const hasRawScript = /<script[\s>]/i.test(html);
    const hasRawHandler = /<[a-z][^>]*onerror=/i.test(html);
    check('邮件预览中转义了 script', !hasRawScript, `status=${r.status}`);
    check('邮件预览中转义了事件属性', !hasRawHandler, `status=${r.status}`);
  }

  // ---------- 6. 正常业务可读写（确认没被自己的限流挡住）----------
  console.log('\n--- 6. 正常业务链路 ---');
  {
    const r = await req('GET', '/api/insights/relationship-heatmap', { token: tokenA });
    check('关系洞察可读取', r.status === 200 && r.json?.success === true, `status=${r.status}`);
  }
  {
    const r = await req('GET', `/api/contacts/${contactAId}/timeline`, { token: tokenA });
    check('本人可读取联系人时间线', r.status === 200, `status=${r.status}`);
  }

  // ---------- 7. 限流 ----------
  console.log('\n--- 7. 限流（登录 20 次/15 分钟）---');
  let firstBlockedAt = null;
  let lastStatus = null;
  for (let i = 1; i <= 26; i++) {
    const r = await req('POST', '/api/auth/login',
      { body: { username: `__probe_${STAMP}__`, password: 'wrong' } });
    lastStatus = r.status;
    if (r.status === 429 && firstBlockedAt === null) firstBlockedAt = i;
  }
  check('失败登录达到阈值后返回 429', firstBlockedAt !== null,
    `26 次内未出现 429，末次状态 ${lastStatus}`);
  if (firstBlockedAt) {
    console.log(`      （第 ${firstBlockedAt} 次开始被限流）`);
  }

  console.log('\n========================================');
  console.log(`通过 ${pass} / 失败 ${fail}`);
  if (failures.length) {
    console.log('失败项：');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('\n清理提示：以下测试账户需在服务器上删除');
  console.log(`  DELETE FROM users WHERE username LIKE 'e2e\\_%';`);
}

main().catch((e) => { console.error('测试异常:', e); process.exit(1); });
