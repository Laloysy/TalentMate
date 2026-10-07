const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db'); // to be created
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// POST /api/auth/register
// 注册接口套用限流：防止批量注册（登录成功不计数，只统计失败尝试）
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: '请填写所有必填字段' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: '邮箱格式不正确' });
    }

    // Password length check
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码至少需要6位' });
    }

    // Check if username already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: '用户名已被注册' });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    // Auto-login: generate JWT
    const token = jwt.sign(
      { userId: result.insertId, username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: { token, userId: result.insertId, username, email, has_seen_tour: 0 },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: '服务器错误，请稍后重试' });
  }
});

// POST /api/auth/login
// 登录接口套用限流：登录成功不计入，失败尝试累计，用于挡住密码暴力破解
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请填写用户名和密码' });
    }

    // Find user
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const user = users[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: { token, userId: user.id, username: user.username, email: user.email, has_seen_tour: user.has_seen_tour || 0 },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: '服务器错误，请稍后重试' });
  }
});

// PUT /api/auth/complete-tour — mark tour as seen (no auth middleware at top, add inline)
const authMiddleware = require('../middleware/auth');
router.put('/complete-tour', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    await pool.query('UPDATE users SET has_seen_tour = 1 WHERE id = ?', [userId]);
    res.json({ success: true, message: '导览已完成' });
  } catch (err) {
    console.error('Complete tour error:', err);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

module.exports = router;
