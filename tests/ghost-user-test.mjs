/**
 * 决定性验证：账户被删除后，旧 token 应返回 401 而不是 500。
 *
 * 这正好复现我清理测试数据后出现的现象：
 * 清理脚本删掉了用户，但 App 里还留着有效 JWT —— 于是每次语音都 500。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = 'http://49.232.160.212';
const KEY = 'C:/Users/Sytus/Documents/deepseek-harness/default-workspace/.deploy/dsfortalent.pem';
const HOST = 'root@49.232.160.212';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  -> ' + detail : ''}`); }
}

async function api(method, p, { token, body } = {}) {
  const r = await fetch(BASE + p, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

/** 在服务器上执行一段 SQL（复用切换前的 .env 备份里的 root 密码） */
function runSql(sql) {
  const local = 'C:/Users/Sytus/Documents/deepseek-harness/default-workspace/.deploy/_ghost.sql';
  fs.writeFileSync(local, sql, 'utf8');
  const sshArgs = ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'IdentitiesOnly=yes'];
  execFileSync('scp', [...sshArgs, local, `${HOST}:/tmp/_ghost.sql`], { stdio: 'pipe' });
  const remote = `
set -e
cd /root/talentmate
BACKUP="$(ls -1t /root/talentmate-backups/env-* | head -1)"
RP="$(sed -n 's/^DB_PASSWORD=//p' "$BACKUP" | head -1)"
umask 077
printf '[client]\\nuser=root\\npassword=%s\\n' "$RP" > /tmp/.g.cnf
docker cp /tmp/.g.cnf voice-calendar-db:/tmp/.g.cnf >/dev/null
docker cp /tmp/_ghost.sql voice-calendar-db:/tmp/_ghost.sql >/dev/null
rm -f /tmp/.g.cnf
docker exec voice-calendar-db sh -c 'mysql --defaults-extra-file=/tmp/.g.cnf < /tmp/_ghost.sql' 2>&1 | grep -v '^mysql:'
docker exec voice-calendar-db rm -f /tmp/.g.cnf /tmp/_ghost.sql
`;
  return execFileSync('ssh', [...sshArgs, HOST, remote.replace(/\r/g, '')], { encoding: 'utf8' });
}

async function main() {
  const stamp = String(Date.now()).slice(-6);
  const u = { username: 'ghost_' + stamp, email: 'ghost_' + stamp + '@example.com', password: 'Test123456' };

  const reg = await api('POST', '/api/auth/register', { body: u });
  if (!reg.json?.success) { console.error('注册失败', reg.status, JSON.stringify(reg.json)); process.exit(1); }
  const token = reg.json.data.token;
  const userId = reg.json.data.userId;
  console.log(`测试账户: ${u.username} (userId=${userId})\n`);

  console.log('--- 阶段 1：账户存在时 ---');
  const a = await api('GET', '/api/events', { token });
  check('GET /api/events 返回 200', a.status === 200, `status=${a.status}`);
  const b = await api('POST', '/api/events', { token, body: { title: '删除前的日程', startTime: '2026-10-09 10:00' } });
  check('POST /api/events 返回 201', b.status === 201, `status=${b.status}`);

  console.log('\n--- 阶段 2：在服务器侧删除该账户（token 保持不变）---');
  const out = runSql(`
USE voice_calendar;
DELETE l FROM interaction_logs l JOIN users u ON u.id = l.user_id WHERE u.username = '${u.username}';
DELETE FROM users WHERE username = '${u.username}';
SELECT COUNT(*) AS remaining FROM users WHERE id = ${userId};
`);
  console.log(out.trim().split('\n').map((l) => '  ' + l).join('\n'));

  console.log('\n--- 阶段 3：用旧 token 再次请求 ---');
  const c = await api('GET', '/api/events', { token });
  console.log(`  GET /api/events  -> HTTP ${c.status}  ${c.json?.message || ''}`);
  check('账户已删除时返回 401（而不是 500）', c.status === 401, `status=${c.status}`);
  check('返回可理解的提示', /账户不存在|重新登录/.test(c.json?.message || ''), c.json?.message);

  const d = await api('POST', '/api/events', { token, body: { title: '删除后的日程', startTime: '2026-10-09 11:00' } });
  console.log(`  POST /api/events -> HTTP ${d.status}  ${d.json?.message || ''}`);
  check('写操作同样返回 401（不再撞外键 500）', d.status === 401, `status=${d.status}`);

  console.log('\n--- 阶段 4：确认没有产生孤儿数据 ---');
  const ev = runSql(`
USE voice_calendar;
SELECT COUNT(*) AS orphan_events FROM events e
  LEFT JOIN users u ON u.id = e.user_id WHERE u.id IS NULL;
`);
  console.log(ev.trim().split('\n').map((l) => '  ' + l).join('\n'));

  console.log(`\n========================================`);
  console.log(`通过 ${pass} / 失败 ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('异常:', e.message); process.exit(1); });
