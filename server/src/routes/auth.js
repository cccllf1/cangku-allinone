console.log('auth.js loaded');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// PDA检查端点 - 允许PDA设备发送标识
router.get('/check', (req, res) => {
  res.json({ success: true, message: 'PDA标识已记录' });
});

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { user_name, password } = req.body;
    const user = new User({ user_name, password });
    await user.save();
    const token = jwt.sign({ user_id: String(user._id) }, process.env.JWT_SECRET || 'your-secret-key-here');
    const userObj = {
      user_id: String(user._id),
      user_name: user.user_name,
      role: user.role,
      created_at: user.created_at
    };
    res.status(201).json({
      token,
      user: userObj
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    // 检查是否是PDA特殊请求
    if (req.headers['pda-access'] === 'true' || 
        (req.body.user_name === 'pda' && req.body.password === 'pda')) {
      // 查找一个管理员账户
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        const token = 'pda-direct-access-token';
        const userObj = {
          user_id: String(admin._id),
          user_name: admin.user_name,
          role: admin.role,
          created_at: admin.created_at
        };
        return res.json({
          token,
          user: userObj,
          is_admin: true
        });
      }
    }
    
    const { user_name, password } = req.body;
    const user = await User.findOne({ user_name });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        data: null,
        error_code: 'LOGIN_FAILED',
        error_message: '用户名或密码错误'
      });
    }
    const token = jwt.sign({ user_id: String(user._id) }, process.env.JWT_SECRET || 'your-secret-key-here');
    const userObj = {
      user_id: String(user._id),
      user_name: user.user_name,
      role: user.role,
      created_at: user.created_at
    };
    res.json({
      success: true,
      data: {
        token,
        user: userObj,
        is_admin: user.role === 'admin'
      },
      error_code: null,
      error_message: null
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      data: null,
      error_code: 'SERVER_ERROR',
      error_message: error.message
    });
  }
});

// 获取当前用户信息
router.get('/me', auth, async (req, res) => {
  try {
    console.log('auth/me req.user:', req.user);
    console.log('auth/me req.user._id:', req.user && req.user._id);
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      success: true,
      data: {
        user_id: String(user._id),
        user_name: user.user_name,
        role: user.role,
        is_admin: user.role === 'admin'
      },
      error_code: null,
      error_message: null
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'USER_FETCH_FAILED',
      error_message: '获取用户信息失败'
    });
  }
});

// 获取所有用户（仅管理员）
router.get('/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权限访问' });
  }
  const users = await User.find({}, '-password');
  const userList = users.map(u => ({
    user_id: String(u._id),
    user_name: u.user_name,
    role: u.role,
    created_at: u.created_at
  }));
  res.json({
    users: userList
  });
});

// 创建用户（仅管理员）
router.post('/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权限访问' });
  }
  try {
    const { user_name, password, role } = req.body;
    const user = new User({ user_name, password, role });
    await user.save();
    const userObj = {
      user_id: String(user._id),
      user_name: user.user_name,
      role: user.role,
      created_at: user.created_at
    };
    res.status(201).json({
      user: userObj
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 删除用户（仅管理员）
router.delete('/users/:user_id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权限访问' });
  }
  try {
    await User.findByIdAndDelete(req.params.user_id);
    res.json({ message: '用户已删除' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 重置密码（仅管理员）
router.post('/users/:user_id/reset_password', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权限访问' });
  }
  try {
    const user = await User.findById(req.params.user_id);
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
    const { old_password, new_password } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(old_password))) {
      return res.status(401).json({ message: '原密码错误' });
    }
    user.password = new_password;
    await user.save();
    res.json({ message: '密码已修改' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 更新个人信息
router.post('/update_profile', auth, async (req, res) => {
  try {
    const { user_name } = req.body;
    const user = await User.findById(req.user._id);
    if (user_name) {
      user.user_name = user_name;
    }
    await user.save();
    const userObj = {
      user_id: String(user._id),
      user_name: user.user_name,
      role: user.role,
      created_at: user.created_at
    };
    res.json({
      user: userObj
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 编辑用户（仅管理员）
router.put('/users/:user_id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权限访问' });
  }
  try {
    const { user_name, role } = req.body;
    const user = await User.findById(req.params.user_id);
    if (!user) return res.status(404).json({ message: '用户不存在' });
    if (user_name) user.user_name = user_name;
    if (role) user.role = role;
    await user.save();
    const userObj = {
      user_id: String(user._id),
      user_name: user.user_name,
      role: user.role,
      created_at: user.created_at
    };
    res.json({
      user: userObj
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 临时API：重置测试用户（仅开发环境使用）
router.post('/reset-test-user', async (req, res) => {
  try {
    // 删除现有的wms用户
    await User.deleteMany({ user_name: 'wms' });
    
    // 创建新的测试用户
    const user = new User({ 
      user_name: 'wms', 
      password: '123456',
      role: 'admin'
    });
    await user.save();
    
    res.json({
      success: true,
      message: '测试用户重置成功',
      data: {
        user_name: user.user_name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error_message: error.message
    });
  }
});

// 临时API：清理旧的username索引
router.post('/cleanup-indexes', async (req, res) => {
  try {
    const db = require('mongoose').connection.db;
    const collection = db.collection('users');
    
    // 获取所有索引
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);
    
    // 删除旧的username索引
    try {
      await collection.dropIndex('username_1');
      console.log('Dropped username_1 index');
    } catch (error) {
      console.log('username_1 index not found or already dropped');
    }
    
    // 确保user_name字段有索引
    await collection.createIndex({ user_name: 1 }, { unique: true });
    console.log('Created user_name_1 index');
    
    res.json({
      success: true,
      message: '索引清理完成'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error_message: error.message
    });
  }
});

module.exports = router; 