const mongoose = require('mongoose');
const User = require('./src/models/User');

// 使用环境变量连接数据库
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin_user:your_strong_password@mongo:8612/cangku-guanli?authSource=admin';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  const user = await User.findOne({ user_name: 'WMS' });
  if (!user) {
    await User.create({ user_name: 'WMS', password: '123456', role: 'admin' });
    console.log('管理员用户已创建：WMS/123456');
  } else {
    console.log('用户已存在');
  }
  mongoose.disconnect();
}); 