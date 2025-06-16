const mongoose = require('mongoose');
const User = require('./src/models/User');

// 修改为群晖的内网IP
mongoose.connect('mongodb://admin_user:your_strong_password@192.168.11.252:8612/cangku-guanli?authSource=admin', {
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