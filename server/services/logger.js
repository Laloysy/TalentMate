/**
 * 日志脱敏（方案 §17 P1）。
 *
 * 生产日志不得出现 JWT、密码、SMTP 凭证、云服务密钥、完整音频与
 * 不必要的联系人敏感信息。
 *
 * 用法：在 console.* 之前套一层，例如
 *   const log = require('./logger');
 *   log.error('Login error:', err);
 *   log.info('[Voice] event:', { id, title });
 *
 * 设计取舍：
 *   - 只做「浅层 + 一层嵌套」的对象遍历，够覆盖本项目实际用法又不会过慢；
 *   - 命中敏感 key 直接替换为 [redacted]，不做部分保留（宁可少记也不要泄漏）；
 *   - 对字符串里形如 Bearer xxx 的内容也做替换，避免 token 混在 message 里。
 */
const SENSITIVE_KEY = /pass(word)?|secret|token|jwt|authorization|credential|api[_-]?key|access[_-]?key|private[_-]?key|signature|session|cookie/i;

/** 这些 key 记录时只保留长度，便于排查但不泄漏内容 */
const LENGTH_ONLY_KEY = /audio|buffer|body|content|transcript|detail|notes/i;

const REDACTED = '[redacted]';

/** 替换字符串中的 Bearer token 与长 base64/hex 串（JWT 常见形态） */
function scrubString(value) {
  return String(value)
    .replace(/Bearer\s+[\w.\-]+/gi, `Bearer ${REDACTED}`)
    // JWT：三段 base64url，用点分隔
    .replace(/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g, REDACTED)
    // 其它长 hex / base64 串（云服务密钥、签名）
    .replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, REDACTED);
}

/**
 * 递归脱敏。depth 限制为 2 层，避免循环引用或超大对象拖慢日志。
 * @param {*} value
 * @param {number} depth
 */
function redact(value, depth = 0) {
  if (value == null) return value;

  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'function') return '[function]';

  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message || ''),
      // 不输出 stack，stack 里常带连接串与路径
    };
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (Array.isArray(value)) {
    if (depth >= 2) return `[Array(${value.length})]`;
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }

  if (typeof value === 'object') {
    if (depth >= 2) return '[object]';
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = REDACTED;
      } else if (LENGTH_ONLY_KEY.test(key)) {
        out[key] = typeof val === 'string' ? `[${val.length} chars]` : REDACTED;
      } else {
        out[key] = redact(val, depth + 1);
      }
    }
    return out;
  }

  return value;
}

/** 把任意参数列表转发给 console 之前先脱敏 */
function emit(level, args) {
  const safe = args.map((arg) => redact(arg));
  // eslint-disable-next-line no-console
  console[level](...safe);
}

module.exports = {
  redact,
  scrubString,
  info: (...args) => emit('log', args),
  warn: (...args) => emit('warn', args),
  error: (...args) => emit('error', args),
};
