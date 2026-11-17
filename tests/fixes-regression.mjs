/**
 * 测试报告缺陷的回归验证（后端部分）。
 *
 * 覆盖：
 *   BUG-003  提前提醒 0 分钟被存成 10 分钟
 *   BUG-009  姓名+邮箱完全相同仍可重复创建（以及大小写不同的同一邮箱）
 *   CSV 导入与手动新增使用同一套去重规则
 *   BUG-008  删除联系人后 events.contact_id 应被置空（前端即时刷新）
 *
 * 用法：
 *   QA_BASE=http://127.0.0.1:3011 node tests/fixes-regression.mjs
 * 默认打本地 QA 实例，不会碰生产库。
 */

const BASE = process.env.QA_BASE || 'http://127.0.0.1:3011';

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? `  -> ${detail}` : ''}`);
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await resp.json(); } catch { /* 非 JSON 响应 */ }
  return { status: resp.status, json };
}

const stamp = Date.now();
const username = `qa_fix_${stamp}`;
const email = `${username}@example.com`;

const reg = await api('/api/auth/register', {
  method: 'POST',
  body: { username, email, password: 'qa123456' },
});
if (!reg.json?.success) {
  console.error('注册失败，无法继续：', reg.status, reg.json);
  process.exit(2);
}
const token = reg.json.data.token;
console.log(`测试账号: ${username}\n`);

// ---------------------------------------------------------------- BUG-003
console.log('[BUG-003] 提前提醒 0 分钟');

const created = await api('/api/events', {
  method: 'POST',
  token,
  body: { title: 'QA reminder 0', startTime: '2026-12-01 10:00', reminder: 0 },
});
ok('创建提醒 0 分钟的日程返回 201', created.status === 201, `status=${created.status}`);
const evId = created.json?.data?.id;

async function getEvent(id) {
  // 查询窗口要覆盖所有测试日程（12-01 / 12-02 都在这段区间内）
  const r = await api('/api/events?startDate=2026-11-01 00:00:00&endDate=2027-01-01 00:00:00', { token });
  return (r.json?.data || []).find((e) => e.id === id);
}

const saved0 = await getEvent(evId);
ok('保存后 reminder 仍为 0（核心修复）', saved0?.reminder === 0, `实际=${saved0?.reminder}`);

const noReminder = await api('/api/events', {
  method: 'POST',
  token,
  body: { title: 'QA 未填提醒', startTime: '2026-12-01 11:00' },
});
const savedDefault = await getEvent(noReminder.json?.data?.id);
ok('未填提醒时回落到默认 10 分钟', savedDefault?.reminder === 10, `实际=${savedDefault?.reminder}`);

const evTmp = await api('/api/events', {
  method: 'POST',
  token,
  body: { title: 'QA 改提醒', startTime: '2026-12-01 12:00', reminder: 30 },
});
const put0 = await api(`/api/events/${evTmp.json?.data?.id}`, {
  method: 'PUT',
  token,
  body: { reminder: 0 },
});
ok('PUT 也能把提醒改成 0', put0.status === 200 && put0.json?.data?.reminder === 0,
  `status=${put0.status} reminder=${put0.json?.data?.reminder}`);

// ---------------------------------------------------------------- BUG-009
console.log('\n[BUG-009] 联系人重复');

const c1 = await api('/api/contacts', {
  method: 'POST', token, body: { name: '张伟', email: 'zw@example.com' },
});
ok('首次创建联系人成功', c1.status === 201, `status=${c1.status}`);

const c2 = await api('/api/contacts', {
  method: 'POST', token, body: { name: '张伟', email: 'zw@example.com' },
});
ok('姓名+邮箱完全相同被拒绝', c2.status === 409, `status=${c2.status}`);
ok('拒绝时返回 DUPLICATE_CONTACT 便于前端提示',
  c2.json?.code === 'DUPLICATE_CONTACT', `code=${c2.json?.code}`);

const c3 = await api('/api/contacts', {
  method: 'POST', token, body: { name: '张伟', email: 'zw_另一个@example.com' },
});
ok('同名但邮箱不同应允许（两个不同的人）', c3.status === 201, `status=${c3.status}`);

const c4 = await api('/api/contacts', {
  method: 'POST', token, body: { name: '另一个名字', email: 'ZW@Example.com' },
});
ok('同一邮箱大小写不同也被拒绝', c4.status === 409, `status=${c4.status}`);

// 连续两次提交（模拟双击）：只应落一条
const dupIds = new Set();
for (let i = 0; i < 2; i += 1) {
  const r = await api('/api/contacts', {
    method: 'POST', token, body: { name: '双击', email: 'double@example.com' },
  });
  if (r.status === 201) dupIds.add(r.json?.data?.id);
}
ok('连续两次相同提交只落一条', dupIds.size === 1, `落库=${dupIds.size} 条`);

// ---------------------------------------------------------------- CSV 去重
console.log('\n[CSV] 导入去重');

const csv = [
  'name,email,department,role',
  '张伟,zw@example.com,研发部,产品经理',        // 已存在
  '王芳,wangfang@example.com,市场部,市场专员',   // 新增
].join('\n');
const imp = await api('/api/contacts/import-csv', { method: 'POST', token, body: { csv } });
ok('CSV 导入成功', imp.status === 200 && imp.json?.success === true, `status=${imp.status}`);
ok('已存在的邮箱被跳过', imp.json?.data?.duplicated === 1, `duplicated=${imp.json?.data?.duplicated}`);
ok('新联系人正常导入', imp.json?.data?.inserted === 1, `inserted=${imp.json?.data?.inserted}`);

// ---------------------------------------------------------------- BUG-008
console.log('\n[BUG-008] 删除联系人后关联日程');

const cDel = await api('/api/contacts', {
  method: 'POST', token, body: { name: '待删除', email: 'todelete@example.com' },
});
const contactId = cDel.json?.data?.id;
const evLinked = await api('/api/events', {
  method: 'POST',
  token,
  body: {
    title: 'QA 关联日程', startTime: '2026-12-02 09:00', contactId,
  },
});
const linkedId = evLinked.json?.data?.id;

const beforeDel = await getEvent(linkedId);
ok('删除前日程带联系人', beforeDel?.contact_id === contactId && !!beforeDel?.contact_name,
  `contact_id=${beforeDel?.contact_id}`);

await api(`/api/contacts/${contactId}`, { method: 'DELETE', token });

const afterDel = await getEvent(linkedId);
ok('删除联系人后日程保留（数据不丢）', !!afterDel, afterDel ? '' : '日程被删除了');
ok('删除联系人后 contact_id 立即置空', afterDel?.contact_id === null, `contact_id=${afterDel?.contact_id}`);
ok('删除联系人后不再返回旧联系人姓名', !afterDel?.contact_name, `contact_name=${afterDel?.contact_name}`);

// ---------------------------------------------------------------- 汇总
console.log(`\n===== 后端回归结果: ${pass} 通过 / ${fail} 失败 =====`);
if (fail) {
  console.log('失败项:', failures.join(', '));
  process.exit(1);
}
