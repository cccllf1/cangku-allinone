const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // 检查请求头中是否有特定的移动设备标识
    const isMobile = req.headers['user-agent']?.includes('Mobile') || 
                req.headers['user-agent']?.includes('Android') ||
                req.headers['user-agent']?.includes('iPhone') ||
                req.headers['pda-access'] === 'true' ||
                req.headers['mobile-access'] === 'true';
    
    // 从请求头或查询参数中获取token
    let token = req.header('Authorization')?.replace('Bearer ', '') || 
                req.query.token;
    
    // 没有token直接拒绝
    if (!token) {
      return res.status(401).json({ message: '请先登录' });
    }
    // 正常JWT验证流程
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: '用户不存在' });
      }
      req.user = user;
      req.token = token;
      next();
    } catch (error) {
      return res.status(401).json({ message: '认证失败，请重新登录' });
    }
  } catch (error) {
    console.error('认证失败:', error);
    return res.status(401).json({ message: '认证失败，请重新登录' });
  }
};

module.exports = auth; 