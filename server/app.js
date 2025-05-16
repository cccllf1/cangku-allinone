const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const authRoutes = require('./src/routes/auth');
const User = require('./src/models/User');
const productsRoutes = require('./src/routes/products');
const locationsRoutes = require('./src/routes/locations');
const inventoryRoutes = require('./src/routes/inventory');
const inboundRoutes = require('./src/routes/inbound');
const outboundRoutes = require('./src/routes/outbound');
const uploadRoutes = require('./src/routes/upload');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 创建上传文件夹
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('已创建上传文件夹:', uploadDir);
} else {
  console.log('上传文件夹已存在:', uploadDir);
  // 列出文件夹中的文件
  const files = fs.readdirSync(uploadDir);
  console.log('上传文件夹中的文件:', files);
}

// 静态文件服务
app.use('/uploads', (req, res, next) => {
  console.log('访问上传文件:', req.url);
  console.log('完整请求路径:', req.protocol + '://' + req.get('host') + req.originalUrl);
  next();
}, express.static(uploadDir, {
  setHeaders: function (res, path, stat) {
    // 设置缓存控制和CORS头信息
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Access-Control-Allow-Origin', '*');
    // 输出文件信息到日志
    console.log('提供文件:', path);
    console.log('文件大小:', stat.size, 'bytes');
  }
}));
console.log('已配置静态文件服务路径:', '/uploads', '->',  uploadDir);

// 测试路由，用于检查静态文件配置
app.get('/api/uploads-check', (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    res.json({
      message: '上传目录检查成功',
      uploadDir,
      files,
      baseUrl: req.protocol + '://' + req.get('host'),
      uploadUrl: req.protocol + '://' + req.get('host') + '/uploads'
    });
  } catch (error) {
    res.status(500).json({
      message: '上传目录检查失败',
      error: error.message,
      uploadDir
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inbound', inboundRoutes);
app.use('/api/outbound', outboundRoutes);
app.use('/api/upload', uploadRoutes);

// 这里用环境变量读取 MongoDB 连接字符串
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(async () => {
    console.log('MongoDB connected');
    // 直接在这里创建管理员用户
    const user = await User.findOne({ username: 'wms' });
    if (!user) {
      await User.create({ username: 'wms', password: '123456', role: 'admin' });
      console.log('管理员用户已创建：wms/123456');
    } else {
      console.log('管理员用户已存在');
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器内部错误' });
});

const PORT = process.env.PORT || 8611;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});