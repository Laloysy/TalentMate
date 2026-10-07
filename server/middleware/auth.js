const jwt = require('jsonwebtoken');
const pool = require('../db');

/**
 * JWT authentication middleware.
 *
 * 除密码学校验外，还必须确认用户仍然存在：
 * 只验签名的话，一个「用户已被删除、但 token 还没过期」的请求会通过，
 * 带着一个不存在的 user_id 继续往下走 —— 任何写操作都会撞上
 * user_id 的外键约束，以 500「服务器内部错误」结束。
 * 这类请求在语义上就是未认证，应当返回 401 让前端重新登录。
 *
 * 这里多一次主键查询（users.id 是主键，开销很小），换取
 * 「无效用户不会以 500 的形式暴露成服务器故障」。
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: '未登录，请先登录',
    });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: '登录已过期，请重新登录',
    });
  }

  // 校验用户仍然存在（token 有效但账户已被删除的情况）
  try {
    const [rows] = await pool.query(
      'SELECT id, username FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '账户不存在或已被删除，请重新登录',
      });
    }
    // 以数据库里的 username 为准，避免 token 里的旧值与实际不一致
    req.user = { id: rows[0].id, username: rows[0].username };
    next();
  } catch (err) {
    console.error('Auth user lookup error:', err);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
}

module.exports = authMiddleware;
