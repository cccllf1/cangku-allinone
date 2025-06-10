const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// 连接MongoDB数据库
const MONGO_URI = 'mongodb://localhost:27017/cangku-database';

async function resetPassword() {
  try {
    // 连接到数据库
    console.log('正在连接数据库...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('数据库连接成功');

    // 获取User模型
    const User = mongoose.model('User', new mongoose.Schema({
      username: String,
      password: String,
      role: String
    }));

    // 查找wms用户
    const user = await User.findOne({ username: 'wms' });
    
    if (!user) {
      console.log('未找到用户wms，尝试创建');
      // 创建新用户
      const newUser = new User({
        username: 'wms',
        password: await bcrypt.hash('123456', 10),
        role: 'admin'
      });
      await newUser.save();
      console.log('已创建新用户wms，密码: 123456');
    } else {
      // 更新用户密码
      user.password = await bcrypt.hash('123456', 10);
      await user.save();
      console.log('已重置用户wms的密码为: 123456');
    }

    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  } catch (error) {
    console.error('发生错误:', error);
  }
}

resetPassword(); 