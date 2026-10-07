/**
 * 通过 CDP 在 APK 的 WebView 内执行 JS。
 *
 * 用法:
 *   node cdp.mjs "<单行表达式>"
 *   node cdp.mjs --file <脚本路径>      # 读取文件内容执行（避免 PowerShell 多行传参问题）
 */
import fs from 'node:fs';

const PORT = 9222;
let expr;
if (process.argv[2] === '--file') {
  expr = fs.readFileSync(process.argv[3], 'utf8');
} else {
  expr = process.argv[2];
}
if (!expr) { console.error('usage: node cdp.mjs "<js>" | --file <path>'); process.exit(2); }

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) { console.error('no page target'); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP timeout (60s)')), 60000);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true },
      }));
    });
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id === 1) { clearTimeout(timer); resolve(m); }
    });
    ws.addEventListener('error', (err) => { clearTimeout(timer); reject(new Error(String(err.message || err))); });
  });
  ws.close();

  const r = result.result;
  if (r?.exceptionDetails) {
    console.log('EXCEPTION: ' + (r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)));
    process.exit(1);
  }
  const v = r?.result?.value;
  console.log(typeof v === 'string' ? v : JSON.stringify(v));
}

main().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
