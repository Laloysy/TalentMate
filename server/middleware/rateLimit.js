/**
 * 接口限流（方案 §17 P0）。
 *
 * 重点保护会消耗外部服务额度或可被暴力破解的接口：
 *   POST /api/auth/login       —— 防密码暴力破解
 *   POST /api/auth/register    —— 防批量注册
 *   POST /api/voice/recognize  —— 消耗腾讯云 ASR + DeepSeek
 *   POST /api/mail/preview     —— 服务端渲染邮件模板
 *
 * 计数键优先用「已登录用户 id」，回退到 IP：
 *   同一出口 IP 后面可能有很多真实用户（公司网络/校园网），
 *   只按 IP 限流会误伤；已认证的请求按用户维度更准确。
 */
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

/** 统一的超限响应，保持与项目其它接口一致的 { success, message } 结构 */
function limitHandler(message) {
  return (_req, res) => {
    res.status(429).json({ success: false, message });
  };
}

/**
 * 已登录按 userId，未登录退化为 IP。
 *
 * 未登录时必须调用 ipKeyGenerator()：它会把 IPv6 地址归一化到 /56 子网，
 * 否则同一用户换一个 IPv6 地址就能绕过限流（express-rate-limit v7+ 的要求）。
 */
function userOrIpKey(req, res) {
  return req.user?.id ? `u:${req.user.id}` : ipKeyGenerator(req, res);
}

/**
 * 全局兜底限流。
 * 数值取得比较宽松，只用于挡住明显的滥用与爬取，
 * 单用户正常使用（含手机端反复刷新）不会被触发。
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler('请求过于频繁，请稍后再试'),
});

/**
 * 登录 / 注册限流。
 * skipSuccessfulRequests：登录成功不计数，避免正常用户被自己"刷满"，
 * 同时仍然能有效限制失败尝试（暴力破解）。
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler('登录或注册尝试过于频繁，请 15 分钟后再试'),
});

/**
 * 语音识别限流。
 * 一次请求会调用腾讯云 ASR + DeepSeek，成本较高，因此窗口更短、额度更小。
 */
const voiceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler('语音请求过于频繁，请稍后再试'),
});

/** 邮件预览限流：服务端要渲染模板，防止被当作免费的渲染服务滥用 */
const mailLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  keyGenerator: userOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler('邮件预览请求过于频繁，请稍后再试'),
});

module.exports = { globalLimiter, authLimiter, voiceLimiter, mailLimiter };
