const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '请先登录' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ message: '认证失败' });
  }
};

module.exports = auth; 