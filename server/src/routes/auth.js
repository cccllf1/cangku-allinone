const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = new User({ username, password });
    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'your-secret-key-here');
    res.status(201).json({ token, user: { id: user._id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'your-secret-key-here');
    res.json({ token, user: { id: user._id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 获取当前用户信息
router.get('/me', auth, async (req, res) => {
  res.json({ user: { id: req.user._id, username: req.user.username, role: req.user.role } });
});

// 获取所有用户（仅管理员）
router.get('/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权限访问' });
  }
  const users = await User.find({}, '-password');
  res.json({ users });
});

// 创建用户（仅管理员）
router.post('/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权限访问' });
  }
  try {
    const { username, password, role } = req.body;
    const user = new User({ username, password, role });
    await user.save();
    res.status(201).json({ user: { id: user._id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 删除用户（仅管理员）
router.delete('/users/:userId', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权限访问' });
  }
  try {
    await User.findByIdAndDelete(req.params.userId);
    res.json({ message: '用户已删除' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 重置密码（仅管理员）
router.post('/users/:userId/reset_password', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权限访问' });
  }
  try {
    const user = await User.findById(req.params.userId);
    user.password = req.body.new_password || '123456';
    await user.save();
    res.json({ message: '密码已重置' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 修改密码
router.post('/change_password', auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(oldPassword))) {
      return res.status(401).json({ message: '原密码错误' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: '密码已修改' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 更新个人信息
router.post('/update_profile', auth, async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findById(req.user._id);
    if (username) {
      user.username = username;
    }
    await user.save();
    res.json({ user: { id: user._id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 编辑用户（仅管理员）
router.put('/users/:userId', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权限访问' });
  }
  try {
    const { username, role } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: '用户不存在' });
    if (username) user.username = username;
    if (role) user.role = role;
    await user.save();
    res.json({ user: { id: user._id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 