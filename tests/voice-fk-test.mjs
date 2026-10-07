/**
 * 复现并验证 voice.js 的外键修复。
 *
 * 场景：语音建日程时，intent 里带了 resolvedContactId（联系人缓存），
 * 但该联系人随后被删除 —— 修复前会以 500「处理请求时出错」结束。
 *
 * 步骤：
 *   1. 建测试账户，建联系人「张伟」
 *   2. 用真实语音调 voice/recognize → 首次成功（拿到 resolvedContactId 路径）
 *   3. 直接删掉该联系人
 *   4. 再次用同一段语音调用 → 修复后应成功建日程（contact_id 置空），而不是 500
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://49.232.160.212';
const SPEECH = process.argv[2];
if (!SPEECH) { console.error('用法: node voice-fk-test.mjs <16k单声道wav>'); process.exit(2); }

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  -> ' + detail : ''}`); }
}

async function api(method, p, { token, body } = {}) {
  const r = await fetch(BASE + p, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

async function recognize(token) {
  const buf = fs.readFileSync(SPEECH);
  const fd = new FormData();
  fd.append('audio', new Blob([buf], { type: 'audio/wav' }), 'speech.wav');
  const r = await fetch(BASE + '/api/voice/recognize', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

async function main() {
  const stamp = String(Date.now()).slice(-6);
  const u = { username: 'fktest_' + stamp, email: 'fktest_' + stamp + '@example.com', password: 'Test123456' };
  const reg = await api('POST', '/api/auth/register', { body: u });
  if (!reg.json?.success) { console.error('注册失败', reg.status, JSON.stringify(reg.json)); process.exit(1); }
  const token = reg.json.data.token;
  console.log('测试账户:', u.username, '\n');

  const c = await api('POST', '/api/contacts', {
    token, body: { name: '张伟', email: `zw_${stamp}@example.com`, department: '研发部', role: '产品经理' },
  });
  check('创建联系人「张伟」', c.status === 201, `status=${c.status}`);
  const contactId = c.json?.data?.id;
  console.log('  联系人 id =', contactId, '\n');

  console.log('--- 第 1 次语音：联系人存在 ---');
  const first = await recognize(token);
  console.log('  HTTP', first.status, '|', first.json?.message);
  check('首次语音调用成功（非 500）', first.status === 200 && first.json?.success === true,
    `status=${first.status} msg=${first.json?.message}`);

  console.log('\n--- 删除该联系人（模拟联系人被删后 intent 仍带旧 id）---');
  const del = await api('DELETE', `/api/contacts/${contactId}`, { token });
  check('删除联系人成功', del.status === 200, `status=${del.status}`);

  console.log('\n--- 第 2 次语音：联系人已不存在 ---');
  const second = await recognize(token);
  console.log('  HTTP', second.status, '|', second.json?.message);
  check('联系人已删除时不再返回 500', second.status !== 500,
    `status=${second.status} msg=${second.json?.message}`);
  check('退化为无关联日程并成功创建', second.status === 200 && second.json?.success === true,
    `status=${second.status} msg=${second.json?.message}`);

  // 确认新日程确实没有挂到已删除的联系人上
  const ev = await api('GET', '/api/events?startDate=2026-10-01 00:00:00&endDate=2026-11-30 00:00:00', { token });
  const created = (ev.json?.data || []).filter((e) => String(e.title).includes('张伟'));
  check('已创建日程且 contact_id 为空', created.length > 0 && created.every((e) => !e.contact_id),
    JSON.stringify(created.map((e) => ({ id: e.id, contact_id: e.contact_id }))));

  console.log(`\n========================================`);
  console.log(`通过 ${pass} / 失败 ${fail}`);
  console.log(`清理：DELETE FROM users WHERE username LIKE 'fktest\\_%';`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('异常:', e); process.exit(1); });
